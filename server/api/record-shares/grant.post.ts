import { createError, getCookie, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { SESSION_COOKIE_NAME } from "../../utils/session";
import { assertOwner, getRecordTypeConfig } from "../../utils/record-share";

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    throw createError({
      statusCode: 401,
      statusMessage: "You must be logged in to share records.",
    });
  }

  const body = await readBody(event);
  const recordType = String(body?.record_type ?? "").trim();
  const recordId = Number(body?.record_id);
  const sharedEmail = String(body?.shared_email ?? "").trim().toLowerCase();
  const role = String(body?.role ?? "viewer").trim().toLowerCase();

  if (!recordType || !recordId || !sharedEmail || !["viewer", "editor"].includes(role)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Record type, record id, shared email, and role are required.",
    });
  }

  getRecordTypeConfig(recordType);
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

    await assertOwner(client, recordType, recordId, userId);

    const sharedUserResult = await client.query(
      `SELECT user_id
       FROM app_users
       WHERE email = $1`,
      [sharedEmail],
    );
    const sharedUserId = sharedUserResult.rows[0]?.user_id;

    if (!sharedUserId) {
      throw createError({
        statusCode: 404,
        statusMessage: "Shared user not found.",
      });
    }

    await client.query(
      `INSERT INTO record_shares
        (record_type, record_id, owner_user_id, shared_user_id, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (record_type, record_id, shared_user_id)
       DO UPDATE SET role = EXCLUDED.role`,
      [recordType, recordId, userId, sharedUserId, role],
    );

    return { success: true };
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to share record.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
