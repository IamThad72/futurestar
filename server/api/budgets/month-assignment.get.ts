import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { getActiveBudget, getBudgetForPeriod, parseYearMonth } from "../../utils/budgetAccess";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const query = getQuery(event);
  const { year, month } = parseYearMonth(query.year, query.month);
  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const active = await getActiveBudget(client, userId, groupId);
    const { budget, is_override, is_inferred } = await getBudgetForPeriod(
      client,
      userId,
      groupId,
      year,
      month,
    );
    return {
      year,
      month,
      budget,
      is_override,
      is_inferred,
      active_budget_id: active.budget_id,
      active_budget: active,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("month-assignment get failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load month budget assignment." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
