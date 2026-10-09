import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { getActiveBudget, listBudgets } from "../../utils/budgetAccess";
import { listTaxAnnualTotalsForBudgets } from "../../utils/taxAnnualTotals";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const query = getQuery(event);
  const yearRaw = query.year != null ? parseInt(String(query.year), 10) : new Date().getFullYear();
  const taxYear = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const active = await getActiveBudget(client, userId, groupId);
    const budgets = await listBudgets(client, userId, groupId);

    // Stored YTD only — never rebuild from transactions. Deltas are written
    // onto whichever budget is active that day, so sum every household budget.
    const listed = await listTaxAnnualTotalsForBudgets(
      client,
      budgets.map((b) => b.budget_id),
      taxYear,
    );

    return {
      tax_year: taxYear,
      budget_id: active.budget_id,
      ...listed,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("tax annual totals failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load tax annual totals." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
