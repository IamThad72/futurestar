import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId, groupAccessClause, soloUserClause } from "../../utils/group";
import { getBudgetForPeriod, monthDateRange, parseYearMonth } from "../../utils/budgetAccess";
import { generateNote } from "../../utils/aiNote";
import { buildMonthClose, monthCloseSentence } from "~/utils/monthCloseFacts.js";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const query = getQuery(event);
  const now = new Date();
  const { year, month } = parseYearMonth(query.year || now.getFullYear(), query.month || now.getMonth() + 1);
  const { start, end } = monthDateRange(year, month);

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const period = await getBudgetForPeriod(client, userId, groupId, year, month);
    const budgetId = Number(period.budget.budget_id);
    const lineAccess = groupId ? groupAccessClause("e") : soloUserClause("e");
    const lineParams = groupId ? [userId, groupId, budgetId] : [userId, budgetId];
    const budgetParam = groupId ? "$3" : "$2";
    const txAccess = groupId ? groupAccessClause("t") : soloUserClause("t");
    const txParams = groupId ? [userId, groupId, start, end] : [userId, start, end];
    const startIdx = groupId ? 3 : 2;
    const endIdx = groupId ? 4 : 3;

    const [linesResult, txResult] = await Promise.all([
      client.query(
        `SELECT expense_category AS category, sub_category, monthly_budget_amt AS monthly_amount
         FROM expenses e
         WHERE ${lineAccess}
           AND e.budget_id = ${budgetParam}
           AND COALESCE(e.expense_type, 'expense') = 'expense'`,
        lineParams,
      ),
      client.query(
        `SELECT COALESCE(t.category, 'Uncategorized') AS category,
                t.sub_category,
                t.description,
                t.amount
         FROM budget_transactions t
         WHERE ${txAccess}
           AND t.transaction_date >= $${startIdx}::date
           AND t.transaction_date < $${endIdx}::date
           AND COALESCE(t.item_kind, 'expense') = 'expense'
           AND COALESCE(t.item_type, 'expense') = 'expense'`,
        txParams,
      ),
    ]);

    const facts = buildMonthClose(linesResult.rows, txResult.rows);
    const monthLabel = `${MONTHS[month - 1]} ${year}`;
    const fallback = monthCloseSentence(facts, monthLabel);
    const text =
      (await generateNote(
        "Write the month-close note in one or two sentences. Describe over budget, under budget, and uncategorized merchants. Do not tell the person what to buy or how to change the budget.",
        { month: monthLabel, ...facts },
      )) || fallback;

    return { year, month, facts, text };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("month close failed", error);
    throw createError({ statusCode: 500, statusMessage: "Could not summarize this month." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
