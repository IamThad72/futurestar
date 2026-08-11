import { createError } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { getBudgetById, listBudgets } from "../../utils/budgetAccess";

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
    const budget = await getBudgetById(client, userId, groupId, budgetId);

    if (budget.is_active) {
      throw createError({
        statusCode: 400,
        statusMessage: "Activate another budget before deleting the active one.",
      });
    }

    const all = await listBudgets(client, userId, groupId);
    if (all.length <= 1) {
      throw createError({ statusCode: 400, statusMessage: "Cannot delete the only budget." });
    }

    await client.query(`DELETE FROM budgets WHERE budget_id = $1`, [budgetId]);
    return { success: true };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("budgets delete failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to delete budget." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
