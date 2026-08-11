import { createError, getQuery } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId, groupAccessClause, soloUserClause } from "../../../utils/group";
import { getActiveBudget, getBudgetForPeriod, monthDateRange } from "../../../utils/budgetAccess";
import { partitionTransactionsForBudget } from "../../../utils/budgetTransactions";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const query = getQuery(event);
  const year = query.year ? parseInt(String(query.year), 10) : null;
  const month = query.month ? parseInt(String(query.month), 10) : null;

  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const active = await getActiveBudget(client, userId, groupId);

    let budget = active;
    let is_override = false;
    let is_inferred = false;
    const hasPeriod =
      year != null && !isNaN(year) && month != null && !isNaN(month) && month >= 1 && month <= 12;
    if (hasPeriod) {
      const period = await getBudgetForPeriod(client, userId, groupId, year, month);
      budget = period.budget;
      is_override = period.is_override;
      is_inferred = period.is_inferred;
    }

    const accessClause = groupId ? groupAccessClause("t") : soloUserClause("t");
    let whereClause = `WHERE ${accessClause}`;
    const params: unknown[] = groupId ? [userId, groupId] : [userId];
    let paramIndex = groupId ? 3 : 2;

    if (hasPeriod) {
      const { start, end } = monthDateRange(year, month);
      whereClause += ` AND t.transaction_date >= $${paramIndex++}::date AND t.transaction_date < $${paramIndex++}::date`;
      params.push(start, end);
    } else if (year != null && !isNaN(year)) {
      whereClause += ` AND t.transaction_date >= $${paramIndex++}::date AND t.transaction_date < $${paramIndex++}::date`;
      params.push(`${year}-01-01`, `${year + 1}-01-01`);
    }

    const result = await client.query(
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
       ${whereClause}
       ORDER BY t.transaction_date DESC, t.transaction_id DESC`,
      params,
    );

    const ownerAccess = groupId ? groupAccessClause() : soloUserClause();
    const budgetParam = groupId ? "$3" : "$2";
    const lineParams = groupId ? [userId, groupId, budget.budget_id] : [userId, budget.budget_id];
    const lineAccess = `${ownerAccess} AND budget_id = ${budgetParam}`;

    const [incomeResult, expensesResult] = await Promise.all([
      client.query(
        `SELECT income_id as id, COALESCE(income_type, 'gross') as income_type,
                income_category as category, sub_category
         FROM income WHERE ${lineAccess}`,
        lineParams,
      ),
      client.query(
        `SELECT expense_id as id, COALESCE(expense_type, 'expense') as expense_type,
                expense_category as category, sub_category
         FROM expenses WHERE ${lineAccess}`,
        lineParams,
      ),
    ]);

    const { transactions, orphans } = partitionTransactionsForBudget(
      result.rows,
      incomeResult.rows,
      expensesResult.rows,
    );

    return {
      transactions,
      orphans,
      active_budget_id: active.budget_id,
      budget,
      is_override,
      is_inferred,
    };
  } catch (error) {
    if (error?.statusCode) throw error;
    console.error("Failed to load transactions", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to load transactions.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
