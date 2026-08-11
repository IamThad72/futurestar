import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { resolveBudgetId } from "../../utils/budgetAccess";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const body = await readBody(event);
  const layout = body?.layout;
  if (!layout || typeof layout !== "object" || Array.isArray(layout)) {
    throw createError({ statusCode: 400, statusMessage: "layout object is required." });
  }

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const budget = await resolveBudgetId(client, userId, groupId, body?.budget_id);

    const existing = await client.query(
      `SELECT layout_id FROM account_map_layouts WHERE budget_id = $1 LIMIT 1`,
      [budget.budget_id],
    );

    if (existing.rows[0]) {
      await client.query(
        `UPDATE account_map_layouts SET layout_json = $1::jsonb, updated_at = NOW() WHERE layout_id = $2`,
        [JSON.stringify(layout), existing.rows[0].layout_id],
      );
    } else {
      await client.query(
        `INSERT INTO account_map_layouts (user_id, group_id, budget_id, layout_json) VALUES ($1, $2, $3, $4::jsonb)`,
        [userId, groupId, budget.budget_id, JSON.stringify(layout)],
      );
    }

    return { success: true, budget_id: budget.budget_id };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("account-map layout save failed", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to save account map layout.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
