import { createError, getQuery } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId, groupAccessClause, soloUserClause } from "../../../utils/group";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const query = getQuery(event);
  const year = query.year ? parseInt(String(query.year), 10) : null;
  const month = query.month ? parseInt(String(query.month), 10) : null;

  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const accessClause = groupId ? groupAccessClause("t") : soloUserClause("t");
    let whereClause = `WHERE ${accessClause}`;
    const params = groupId ? [userId, groupId] : [userId];
    let paramIndex = groupId ? 3 : 2;

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
              t.income_id, t.expense_id, t.cash_investment_id, t.debt_id, t.from_cash_investment_id, t.income_source_id, t.investment_source_id, t.savings_source_id,
              t.principal_applied, t.interest_applied,
              CASE WHEN t.income_id IS NOT NULL THEN 'income' ELSE 'expense' END as type,
              COALESCE(i.income_category, e.expense_category) as category,
              COALESCE(i.sub_category, e.sub_category) as sub_category,
              COALESCE(i.income_type, e.expense_type) as item_type,
              COALESCE(ci.institution, d.institution) as destination_institution,
              COALESCE(ci.acct_type, NULLIF(TRIM(d.loan_type), '')) as destination_acct_type
       FROM budget_transactions t
       LEFT JOIN income i ON t.income_id = i.income_id
       LEFT JOIN expenses e ON t.expense_id = e.expense_id
       LEFT JOIN cash_and_investments ci ON t.cash_investment_id = ci.ci_id
       LEFT JOIN debt d ON t.debt_id = d.dbt_id
       LEFT JOIN income_sources src ON t.income_source_id = src.source_id
       LEFT JOIN investment_sources isrc ON t.investment_source_id = isrc.source_id
       LEFT JOIN savings_sources ssrc ON t.savings_source_id = ssrc.source_id
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
