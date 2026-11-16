import { createError } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId, groupAccessClause, soloUserClause } from "../../utils/group";
import { getBudgetForPeriod } from "../../utils/budgetAccess";
import { generateJson } from "../../utils/groq";
import { candidateMerchants, titleCaseMerchant } from "~/utils/budgetLineSuggestions.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const now = new Date();
  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const period = await getBudgetForPeriod(client, userId, groupId, now.getFullYear(), now.getMonth() + 1);
    const budgetId = Number(period.budget.budget_id);
    const access = groupId ? groupAccessClause() : soloUserClause();
    const lineParams = groupId ? [userId, groupId, budgetId] : [userId, budgetId];
    const budgetParam = groupId ? "$3" : "$2";
    const txParams = groupId ? [userId, groupId] : [userId];

    const [lineResult, merchantResult] = await Promise.all([
      client.query(
        `SELECT expense_category AS category, sub_category
         FROM expenses
         WHERE ${access} AND budget_id = ${budgetParam}`,
        lineParams,
      ),
      client.query(
        `SELECT lower(trim(description)) AS description,
                COUNT(*)::int AS count,
                AVG(ABS(amount)) AS average
         FROM budget_transactions
         WHERE ${access}
           AND description IS NOT NULL
           AND btrim(description) <> ''
           AND transaction_date >= CURRENT_DATE - INTERVAL '180 days'
           AND COALESCE(item_kind, 'expense') = 'expense'
         GROUP BY 1
         HAVING COUNT(*) >= 3
         ORDER BY COUNT(*) DESC
         LIMIT 40`,
        txParams,
      ),
    ]);

    const existing = lineResult.rows.flatMap((row) => [row.category, row.sub_category].filter(Boolean).map(String));
    const candidates = candidateMerchants(merchantResult.rows, existing);
    const named = new Map<string, { category: string; sub_category: string }>();
    if (candidates.length) {
      try {
        const raw = asRecord(
          await generateJson(
            [
              "Name a budget category and sub-category for each repeated merchant.",
              'Return {"lines":[{"description":"netflix","category":"Subscriptions","sub_category":"Netflix"}]}.',
              "description must be copied from merchants. Keep names short. Do not invent merchants.",
            ].join(" "),
            {
              merchants: candidates.map((row) => row.description),
              existing_categories: [...new Set(existing)].slice(0, 80),
            },
          ),
        );
        const list = Array.isArray(raw?.lines) ? raw.lines : [];
        for (const entry of list) {
          const row = asRecord(entry);
          if (!row) continue;
          const description = String(row.description || "").trim().toLowerCase();
          const category = String(row.category || "").trim().slice(0, 80);
          const sub = String(row.sub_category || "").trim().slice(0, 80);
          if (!description || !category) continue;
          named.set(description, { category, sub_category: sub || titleCaseMerchant(description) });
        }
      } catch (error) {
        console.error("budget line names failed", error);
      }
    }

    const existingPairs = new Set(
      lineResult.rows.map((row) =>
        `${String(row.category || "").trim().toLowerCase()}|${String(row.sub_category || "").trim().toLowerCase()}`,
      ),
    );
    const suggestions = candidates
      .map((row) => {
        const name = named.get(row.description);
        const category = name?.category || "Recurring";
        const sub_category = name?.sub_category || titleCaseMerchant(row.description);
        return {
          description: row.description,
          category,
          sub_category,
          expense_type: "expense",
          monthly_amount: row.monthly_amount,
          count: row.count,
        };
      })
      .filter((row) => !existingPairs.has(`${row.category.toLowerCase()}|${row.sub_category.toLowerCase()}`));

    return { budget_id: budgetId, suggestions };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("budget line suggestions failed", error);
    throw createError({ statusCode: 500, statusMessage: "Could not look for missing budget lines." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
