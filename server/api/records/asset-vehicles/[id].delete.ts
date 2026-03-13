import { createError, getCookie } from "h3";
import { createDbClient } from "../../../utils/db";
import { SESSION_COOKIE_NAME } from "../../../utils/session";
import { getUserGroupId } from "../../../utils/group";

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, SESSION_COOKIE_NAME);
  if (!sessionToken) {
    throw createError({ statusCode: 401, statusMessage: "You must be logged in." });
  }

  const id = getRouterParam(event, "id");
  if (!id || !/^\d+$/.test(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid record ID." });
  }

  const client = createDbClient();
  try {
    await client.connect();
    const sessionResult = await client.query(
      `SELECT user_id FROM app_sessions WHERE session_token = $1 AND expires_at > NOW()`,
      [sessionToken],
    );
    const userId = sessionResult.rows[0]?.user_id;
    if (!userId) throw createError({ statusCode: 401, statusMessage: "Session expired." });

    const groupId = await getUserGroupId(client, userId);
    const params = groupId ? [id, userId, groupId] : [id, userId];

    const result = await client.query(
      groupId
        ? `DELETE FROM asset_vehicles WHERE vh_id = $1 AND (user_id = $2 OR group_id = $3)`
        : `DELETE FROM asset_vehicles WHERE vh_id = $1 AND user_id = $2`,
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
