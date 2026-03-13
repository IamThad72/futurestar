import { createError, getCookie } from "h3";
import { createDbClient } from "../../utils/db";
import { SESSION_COOKIE_NAME } from "../../utils/session";
import { getUserGroupId } from "../../utils/group";

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    throw createError({
      statusCode: 401,
      statusMessage: "You must be logged in to view records.",
    });
  }

  const client = createDbClient();

  try {
    await client.connect();
    const sessionResult = await client.query(
      `SELECT user_id
       FROM app_sessions
       WHERE session_token = $1 AND expires_at > NOW()`,
      [sessionToken],
    );

    const userId = sessionResult.rows[0]?.user_id;

    if (!userId) {
      throw createError({
        statusCode: 401,
        statusMessage: "Session expired. Please log in again.",
      });
    }

    const groupId = await getUserGroupId(client, userId);
    const queryText = groupId
      ? `SELECT * FROM debt WHERE user_id = $1 OR group_id = $2 OR user_id IN (SELECT user_id FROM group_members WHERE group_id = $2)`
      : `SELECT * FROM debt WHERE user_id = $1`;
    const params = groupId ? [userId, groupId] : [userId];
    const result = await client.query(queryText, params);

    return { records: result.rows };
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to load debt records.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
