import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { getBudgetById, listBudgets } from "../../utils/budgetAccess";
import { copyBudgetContents } from "../../utils/budgetCopy";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const body = await readBody(event);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: "Budget name is required." });
  }

  const copyFrom =
    body?.copy_from_budget_id != null && body.copy_from_budget_id !== ""
      ? Number(body.copy_from_budget_id)
      : null;
  if (copyFrom != null && (!Number.isFinite(copyFrom) || copyFrom <= 0)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid copy_from_budget_id." });
  }

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);

    const existing = await listBudgets(client, userId, groupId);
    if (existing.some((b) => b.name.trim().toLowerCase() === name.toLowerCase())) {
      throw createError({ statusCode: 400, statusMessage: "A budget with that name already exists." });
    }

    if (copyFrom != null) {
      await getBudgetById(client, userId, groupId, copyFrom);
    }

    const inserted = await client.query(
      `INSERT INTO budgets (user_id, group_id, name, is_active)
       VALUES ($1, $2, $3, FALSE)
       RETURNING budget_id, user_id, group_id, name, is_active, created_at, updated_at`,
      [userId, groupId, name],
    );
    const budget = inserted.rows[0];

    if (copyFrom != null) {
      await copyBudgetContents(client, userId, groupId, copyFrom, Number(budget.budget_id));
    }

    return { budget };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    const msg = String((error as { message?: string })?.message ?? "");
    if (msg.includes("idx_budgets_name")) {
      throw createError({ statusCode: 400, statusMessage: "A budget with that name already exists." });
    }
    console.error("budgets create failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to create budget." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
