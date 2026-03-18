import { createError } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const queryText = groupId
      ? `SELECT * FROM asset_inventory WHERE user_id = $1 OR group_id = $2 OR user_id IN (SELECT user_id FROM group_members WHERE group_id = $2)`
      : `SELECT * FROM asset_inventory WHERE user_id = $1`;
    const params = groupId ? [userId, groupId] : [userId];
    const result = await client.query(queryText, params);

    return { records: result.rows };
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to load asset inventory records.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
