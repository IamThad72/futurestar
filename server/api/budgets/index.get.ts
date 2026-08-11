import { createError } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { ensureActiveBudget, listBudgets } from "../../utils/budgetAccess";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    await ensureActiveBudget(client, userId, groupId);
    const budgets = await listBudgets(client, userId, groupId);
    return {
      budgets,
      active_budget_id: budgets.find((b) => b.is_active)?.budget_id ?? null,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("budgets list failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load budgets." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
