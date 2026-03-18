import { createError, getQuery } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const query = getQuery(event);
  const year = query.year ? parseInt(String(query.year), 10) : null;
  const month = query.month ? parseInt(String(query.month), 10) : null;

  const client = createDbClient();

  try {
    await client.connect();
    let whereClause = "WHERE t.user_id = $1";
    const params = [userId];
    let paramIndex = 2;

    if (year != null && !isNaN(year)) {
      whereClause += ` AND EXTRACT(YEAR FROM t.transaction_date) = $${paramIndex++}`;
      params.push(year);
    }
    if (month != null && !isNaN(month) && month >= 1 && month <= 12) {
      whereClause += ` AND EXTRACT(MONTH FROM t.transaction_date) = $${paramIndex++}`;
      params.push(month);
    }

    const result = await client.query(
      `SELECT t.transaction_id as id, t.transaction_date as date, t.amount, t.description,
              t.income_id, t.expense_id, t.cash_investment_id,
              CASE WHEN t.income_id IS NOT NULL THEN 'income' ELSE 'expense' END as type,
              COALESCE(i.income_category, e.expense_category) as category,
              COALESCE(i.sub_category, e.sub_category) as sub_category,
              COALESCE(i.income_type, e.expense_type) as item_type,
              ci.institution as destination_institution, ci.acct_type as destination_acct_type
       FROM budget_transactions t
       LEFT JOIN income i ON t.income_id = i.income_id AND i.user_id = t.user_id
       LEFT JOIN expenses e ON t.expense_id = e.expense_id AND e.user_id = t.user_id
       LEFT JOIN cash_and_investments ci ON t.cash_investment_id = ci.ci_id
       ${whereClause}
       ORDER BY t.transaction_date DESC, t.transaction_id DESC`,
      params,
    );

    return { transactions: result.rows };
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
