import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { getActiveBudget } from "../../utils/budgetAccess";
import { listTaxAnnualTotals } from "../../utils/taxAnnualTotals";

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

    // Read stored YTD only. Never rebuild from transactions — that wipes the
    // manual baseline. Paycheck tax lines increment via applyTaxAnnualTotalDelta.
    const listed = await listTaxAnnualTotals(client, active.budget_id, taxYear);

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
