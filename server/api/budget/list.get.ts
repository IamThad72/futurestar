import { createError, getCookie } from "h3";
import { createDbClient } from "../../utils/db";
import { SESSION_COOKIE_NAME } from "../../utils/session";

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    throw createError({
      statusCode: 401,
      statusMessage: "You must be logged in to view budgets.",
    });
  }

  const client = createDbClient();

  try {
    await client.connect();
    const sessionResult = await client.query(
      `SELECT user_id
       FROM app_sessions
       WHERE session_token = $1 AND expires_at > NOW()`,
      [sessionToken],
    );

    const userId = sessionResult.rows[0]?.user_id;

    if (!userId) {
      throw createError({
        statusCode: 401,
        statusMessage: "Session expired. Please log in again.",
      });
    }

    const [incomeResult, expensesResult] = await Promise.all([
      client.query(
        `SELECT income_id as id, 'income' as type, COALESCE(income_type, 'gross') as income_type,
          income_category as category, sub_category,
          income_category_desc as description,
          income_category_monthly_amt as monthly_amount,
          income_category_annual_amt as annual_amount,
          created_at
         FROM income WHERE user_id = $1 ORDER BY 
           CASE COALESCE(income_type, 'gross') WHEN 'gross' THEN 1 WHEN 'tax' THEN 2 WHEN 'deduction' THEN 3 ELSE 4 END,
           income_category, sub_category NULLS FIRST`,
        [userId],
      ),
      client.query(
        `SELECT expense_id as id, 'expense' as type, COALESCE(expense_type, 'expense') as expense_type,
          expense_category as category, sub_category,
          expense_category_desc as description,
          monthly_budget_amt as monthly_amount,
          annual_budget_amt as annual_amount,
          created_at
         FROM expenses WHERE user_id = $1 ORDER BY 
           CASE COALESCE(expense_type, 'expense') WHEN 'expense' THEN 1 WHEN 'savings' THEN 2 WHEN 'investment' THEN 3 ELSE 4 END,
           expense_category, sub_category NULLS FIRST`,
        [userId],
      ),
    ]);

    return {
      income: incomeResult.rows,
      expenses: expensesResult.rows,
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
