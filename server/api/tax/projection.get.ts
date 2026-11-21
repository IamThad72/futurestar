import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { countHouseholdPaychecks, loadBudgetPlan } from "../../utils/taxProjection";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const query = getQuery(event);
  const yearRaw = query.year != null ? parseInt(String(query.year), 10) : new Date().getFullYear();
  const taxYear = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();
  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    let paychecksSoFar: number | null = null;
    let budgetPlan = null;
    try {
      paychecksSoFar = await countHouseholdPaychecks(client, userId, groupId, taxYear);
    } catch (error) {
      console.error("paycheck count failed", error);
    }
    try {
      budgetPlan = await loadBudgetPlan(client, userId, groupId);
    } catch (error) {
      console.error("budget plan for tax projection failed", error);
    }
    return { tax_year: taxYear, paychecksSoFar, budgetPlan };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("tax projection failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load tax projection." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
