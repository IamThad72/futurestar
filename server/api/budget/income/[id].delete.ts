import { createError } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId, groupAccessClauseAt, soloUserClauseAt } from "../../../utils/group";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const id = getRouterParam(event, "id");
  if (!id || !/^\d+$/.test(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid budget ID.",
    });
  }

  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const accessClause = groupId ? groupAccessClauseAt("", 2, 3) : soloUserClauseAt("", 2);
    const params = groupId ? [id, userId, groupId] : [id, userId];

    const result = await client.query(
      `DELETE FROM income WHERE income_id = $1 AND ${accessClause} RETURNING income_id`,
      params,
    );

    if (result.rowCount === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: "Budget not found.",
      });
    }

    return { success: true };
  } catch (error) {
    if (error?.statusCode) throw error;
    console.error("Budget delete failed", error);
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "Failed to delete budget.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
