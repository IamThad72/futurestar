import { createError, readBody } from "h3";
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

  const body = await readBody(event);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: "Budget name is required." });
  }

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    await getBudgetById(client, userId, groupId, budgetId);

    const siblings = await listBudgets(client, userId, groupId);
    if (siblings.some((b) => b.budget_id !== budgetId && b.name.trim().toLowerCase() === name.toLowerCase())) {
      throw createError({ statusCode: 400, statusMessage: "A budget with that name already exists." });
    }

    const updated = await client.query(
      `UPDATE budgets SET name = $1, updated_at = NOW()
       WHERE budget_id = $2
       RETURNING budget_id, user_id, group_id, name, is_active, created_at, updated_at`,
      [name, budgetId],
    );
    return { budget: updated.rows[0] };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    const msg = String((error as { message?: string })?.message ?? "");
    if (msg.includes("idx_budgets_name")) {
      throw createError({ statusCode: 400, statusMessage: "A budget with that name already exists." });
    }
    console.error("budgets rename failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to rename budget." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
