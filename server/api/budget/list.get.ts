import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId, groupAccessClause, soloUserClause } from "../../utils/group";
import { getActiveBudget, getBudgetForPeriod, resolveBudgetId } from "../../utils/budgetAccess";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const query = getQuery(event);

  const client = createDbClient();

  const buildExpensesSelect = (withDebt, accessClause) => {
    const debtCols = withDebt ? "cash_investment_id, from_cash_investment_id, debt_id" : "cash_investment_id, from_cash_investment_id";
    return `SELECT expense_id as id, 'expense' as type, COALESCE(expense_type, 'expense') as expense_type,
          expense_category as category, sub_category,
          expense_category_desc as description,
          ${debtCols},
          monthly_budget_amt as monthly_amount,
          annual_budget_amt as annual_amount,
          created_at
         FROM expenses WHERE ${accessClause} ORDER BY 
           CASE COALESCE(expense_type, 'expense') WHEN 'expense' THEN 1 WHEN 'savings' THEN 2 WHEN 'investment' THEN 3 ELSE 4 END,
           expense_category, sub_category NULLS FIRST`;
  };

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);

    const yearNum = query.year != null && query.year !== "" ? Number(query.year) : NaN;
    const monthNum = query.month != null && query.month !== "" ? Number(query.month) : NaN;
    const usePeriod =
      Number.isFinite(yearNum) &&
      yearNum >= 2000 &&
      yearNum <= 2100 &&
      Number.isFinite(monthNum) &&
      monthNum >= 1 &&
      monthNum <= 12;

    let budget;
    let is_override = false;
    let is_inferred = false;
    if (usePeriod) {
      const period = await getBudgetForPeriod(
        client,
        userId,
        groupId,
        Math.trunc(yearNum),
        Math.trunc(monthNum),
      );
      budget = period.budget;
      is_override = period.is_override;
      is_inferred = period.is_inferred;
    } else {
      budget = await resolveBudgetId(client, userId, groupId, query.budget_id);
    }

    const active = await getActiveBudget(client, userId, groupId);
    const ownerAccess = groupId ? groupAccessClause() : soloUserClause();
    const budgetParam = groupId ? "$3" : "$2";
    const accessClause = `${ownerAccess} AND budget_id = ${budgetParam}`;
    const params = groupId ? [userId, groupId, budget.budget_id] : [userId, budget.budget_id];

    const incomeResult = await client.query(
      `SELECT income_id as id, 'income' as type, COALESCE(income_type, 'gross') as income_type,
          income_category as category, sub_category,
          income_category_desc as description,
          cash_investment_id,
          income_category_monthly_amt as monthly_amount,
          income_category_annual_amt as annual_amount,
          created_at
         FROM income WHERE ${accessClause} ORDER BY 
           CASE COALESCE(income_type, 'gross') WHEN 'gross' THEN 1 WHEN 'interest' THEN 2 WHEN 'other' THEN 3 WHEN 'tax' THEN 4 WHEN 'deduction' THEN 5 ELSE 6 END,
           income_category, sub_category NULLS FIRST`,
      params,
    );

    const expensesQueryWithDebt = buildExpensesSelect(true, accessClause);
    const expensesQueryLegacy = buildExpensesSelect(false, accessClause);

    let expensesResult;
    try {
      expensesResult = await client.query(expensesQueryWithDebt, params);
    } catch (expensesErr) {
      const msg = String(expensesErr?.message ?? "");
      if (msg.includes("debt_id") && msg.includes("does not exist")) {
        expensesResult = await client.query(expensesQueryLegacy, params);
        expensesResult.rows = expensesResult.rows.map((row) => ({ ...row, debt_id: null }));
      } else {
        throw expensesErr;
      }
    }

    return {
      income: incomeResult.rows,
      expenses: expensesResult.rows,
      budget,
      is_override,
      is_inferred,
      active_budget_id: active.budget_id,
    };
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to load budgets.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
