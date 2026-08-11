import { createError } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId } from "../../../utils/group";
import { activateBudget } from "../../../utils/budgetAccess";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const budgetId = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(budgetId) || budgetId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "Invalid budget id." });
  }

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const budget = await activateBudget(client, userId, groupId, budgetId);
    return { budget };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("budgets activate failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to activate budget." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
