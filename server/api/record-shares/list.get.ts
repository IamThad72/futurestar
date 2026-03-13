import { createError, getCookie, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { SESSION_COOKIE_NAME } from "../../utils/session";
import { assertOwner, getRecordTypeConfig } from "../../utils/record-share";

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    throw createError({
      statusCode: 401,
      statusMessage: "You must be logged in to view shares.",
    });
  }

  const query = getQuery(event);
  const recordType = String(query?.record_type ?? "").trim();
  const recordId = Number(query?.record_id);

  if (!recordType || !recordId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Record type and record id are required.",
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

    const sharesResult = await client.query(
      `SELECT rs.shared_user_id, au.email, rs.role, rs.created_at
       FROM record_shares rs
       JOIN app_users au ON au.user_id = rs.shared_user_id
       WHERE rs.record_type = $1 AND rs.record_id = $2
       ORDER BY rs.created_at DESC`,
      [recordType, recordId],
    );

    return { shares: sharesResult.rows };
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to load shares.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
