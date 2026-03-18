import { createError } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId } from "../../../utils/group";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const id = getRouterParam(event, "id");
  if (!id || !/^\d+$/.test(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid record ID." });
  }

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const params = groupId ? [id, userId, groupId] : [id, userId];

    const result = await client.query(
      groupId
        ? `DELETE FROM debt WHERE dbt_id = $1 AND (user_id = $2 OR group_id = $3)`
        : `DELETE FROM debt WHERE dbt_id = $1 AND user_id = $2`,
      params,
    );

    if (result.rowCount === 0) {
      throw createError({ statusCode: 404, statusMessage: "Record not found." });
    }
    return { success: true };
  } catch (e) {
    if (e?.statusCode) throw e;
    throw createError({ statusCode: 500, statusMessage: "Failed to delete record." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
