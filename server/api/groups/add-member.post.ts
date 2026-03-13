import { createError, getCookie, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { SESSION_COOKIE_NAME } from "../../utils/session";
import { assertGroupOwner } from "../../utils/group";

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    throw createError({
      statusCode: 401,
      statusMessage: "You must be logged in to add members.",
    });
  }

  const body = await readBody(event);
  const memberEmail = String(body?.member_email ?? "").trim().toLowerCase();

  if (!memberEmail) {
    throw createError({
      statusCode: 400,
      statusMessage: "Member email is required.",
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

    const membership = await assertGroupOwner(client, userId);

    const memberResult = await client.query(
      `SELECT user_id
       FROM app_users
       WHERE email = $1`,
      [memberEmail],
    );
    const memberUserId = memberResult.rows[0]?.user_id;

    if (!memberUserId) {
      throw createError({
        statusCode: 404,
        statusMessage: "User not found.",
      });
    }

    if (memberUserId === userId) {
      throw createError({
        statusCode: 400,
        statusMessage: "You are already in the group.",
      });
    }

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM group_members WHERE group_id = $1`,
      [membership.group_id],
    );
    const memberCount = countResult.rows[0]?.cnt ?? 0;
    if (memberCount >= 6) {
      throw createError({
        statusCode: 400,
        statusMessage: "Group is full. Maximum 6 members allowed.",
      });
    }

    await client.query(
      `INSERT INTO group_members (group_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [membership.group_id, memberUserId, "member"],
    );

    return { success: true };
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to add group member.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
