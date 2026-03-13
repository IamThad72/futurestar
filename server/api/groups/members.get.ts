import { createError, getCookie } from "h3";
import { createDbClient } from "../../utils/db";
import { SESSION_COOKIE_NAME } from "../../utils/session";
import { getUserGroupMembership } from "../../utils/group";

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    throw createError({
      statusCode: 401,
      statusMessage: "You must be logged in to view group members.",
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

    const membership = await getUserGroupMembership(client, userId);

    if (!membership?.group_id) {
      return { group_id: null, group_name: null, role: null, members: [] };
    }

    const membersResult = await client.query(
      `SELECT gm.user_id, au.email, au.display_name, gm.role, gm.created_at
       FROM group_members gm
       JOIN app_users au ON au.user_id = gm.user_id
       WHERE gm.group_id = $1
       ORDER BY gm.created_at ASC`,
      [membership.group_id],
    );

    return {
      group_id: membership.group_id,
      group_name: membership.group_name,
      role: membership.role,
      members: membersResult.rows,
    };
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to load group members.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
