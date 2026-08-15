import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId, groupAccessClause, soloUserClause } from "../../utils/group";
import { ensureActiveBudget, getBudgetForPeriod, listBudgets, monthDateRange, parseYearMonth } from "../../utils/budgetAccess";
import { partitionTransactionsForBudget } from "../../utils/budgetTransactions";

/**
 * Single-request bootstrap for Budget Tracker.
 * Transactions are loaded by date for the month, then matched to the period budget by classification.
 */
export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const query = getQuery(event);
  const { year, month } = parseYearMonth(query.year, query.month);
  const { start, end } = monthDateRange(year, month);

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const active = await ensureActiveBudget(client, userId, groupId);
    const budgets = await listBudgets(client, userId, groupId);
    const period = await getBudgetForPeriod(client, userId, groupId, year, month);
    const budget = period.budget;

    const ownerAccess = groupId ? groupAccessClause() : soloUserClause();
    const budgetParam = groupId ? "$3" : "$2";
    const lineParams = groupId ? [userId, groupId, budget.budget_id] : [userId, budget.budget_id];
    const lineAccess = `${ownerAccess} AND budget_id = ${budgetParam}`;

    const txAccess = groupId ? groupAccessClause("t") : soloUserClause("t");
    const txParams = groupId ? [userId, groupId, start, end] : [userId, start, end];
    const startIdx = groupId ? 3 : 2;
    const endIdx = groupId ? 4 : 3;

    const recordAccess = groupId
      ? `(user_id = $1 OR group_id = $2 OR user_id IN (SELECT user_id FROM group_members WHERE group_id = $2))`
      : `user_id = $1`;
    const recordParams = groupId ? [userId, groupId] : [userId];
    const sourceAccess = groupId ? groupAccessClause() : soloUserClause();

    const [
      incomeResult,
      expensesResult,
      txResult,
      cashResult,
      debtResult,
      incomeSrcResult,
      invSrcResult,
      savSrcResult,
    ] = await Promise.all([
      client.query(
        `SELECT income_id as id, 'income' as type, COALESCE(income_type, 'gross') as income_type,
            income_category as category, sub_category,
            income_category_desc as description,
            cash_investment_id,
            income_category_monthly_amt as monthly_amount,
            income_category_annual_amt as annual_amount,
            created_at
         FROM income WHERE ${lineAccess}
         ORDER BY
           CASE COALESCE(income_type, 'gross')
             WHEN 'gross' THEN 1 WHEN 'interest' THEN 2 WHEN 'other' THEN 3
             WHEN 'tax' THEN 4 WHEN 'deduction' THEN 5 ELSE 6 END,
           income_category, sub_category NULLS FIRST`,
        lineParams,
      ),
      client.query(
        `SELECT expense_id as id, 'expense' as type, COALESCE(expense_type, 'expense') as expense_type,
            expense_category as category, sub_category,
            expense_category_desc as description,
            cash_investment_id, from_cash_investment_id, debt_id,
            monthly_budget_amt as monthly_amount,
            annual_budget_amt as annual_amount,
            created_at
         FROM expenses WHERE ${lineAccess}
         ORDER BY
           CASE COALESCE(expense_type, 'expense')
             WHEN 'expense' THEN 1 WHEN 'savings' THEN 2 WHEN 'investment' THEN 3 ELSE 4 END,
           expense_category, sub_category NULLS FIRST`,
        lineParams,
      ),
      client.query(
        `SELECT t.transaction_id as id, t.transaction_date as date, t.amount, t.description,
                t.income_id, t.expense_id, t.cash_investment_id, t.debt_id, t.from_cash_investment_id,
                t.income_source_id, t.investment_source_id, t.savings_source_id,
                t.principal_applied, t.interest_applied,
                COALESCE(t.item_kind, CASE WHEN t.income_id IS NOT NULL THEN 'income' ELSE 'expense' END) as item_kind,
                COALESCE(t.item_type, i.income_type, e.expense_type) as item_type,
                COALESCE(t.category, i.income_category, e.expense_category) as category,
                COALESCE(t.sub_category, i.sub_category, e.sub_category) as sub_category,
                COALESCE(ci.institution, d.institution) as destination_institution,
                COALESCE(ci.acct_type, NULLIF(TRIM(d.loan_type), '')) as destination_acct_type
         FROM budget_transactions t
         LEFT JOIN income i ON t.income_id = i.income_id
         LEFT JOIN expenses e ON t.expense_id = e.expense_id
         LEFT JOIN cash_and_investments ci ON t.cash_investment_id = ci.ci_id
         LEFT JOIN debt d ON t.debt_id = d.dbt_id
         WHERE ${txAccess}
           AND t.transaction_date >= $${startIdx}::date
           AND t.transaction_date < $${endIdx}::date
         ORDER BY t.transaction_date DESC, t.transaction_id DESC`,
        txParams,
      ),
      client.query(`SELECT * FROM cash_and_investments WHERE ${recordAccess}`, recordParams),
      client.query(`SELECT * FROM debt WHERE ${recordAccess}`, recordParams),
      client
        .query(
          `SELECT source_id as id, name FROM income_sources WHERE ${sourceAccess} ORDER BY lower(name)`,
          recordParams,
        )
        .catch(() => ({ rows: [] })),
      client
        .query(
          `SELECT source_id as id, name FROM investment_sources WHERE ${sourceAccess} ORDER BY lower(name)`,
          recordParams,
        )
        .catch(() => ({ rows: [] })),
      client
        .query(
          `SELECT source_id as id, name FROM savings_sources WHERE ${sourceAccess} ORDER BY lower(name)`,
          recordParams,
        )
        .catch(() => ({ rows: [] })),
    ]);

    const { transactions, orphans } = partitionTransactionsForBudget(
      txResult.rows,
      incomeResult.rows,
      expensesResult.rows,
    );

    return {
      year,
      month,
      budgets,
      budget,
      is_override: period.is_override,
      is_inferred: period.is_inferred,
      active_budget_id: active.budget_id,
      income: incomeResult.rows,
      expenses: expensesResult.rows,
      transactions,
      orphans,
      cash_accounts: cashResult.rows,
      debt_records: debtResult.rows,
      income_sources: incomeSrcResult.rows,
      investment_sources: invSrcResult.rows,
      savings_sources: savSrcResult.rows,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("budget tracker bootstrap failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load budget tracker." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
