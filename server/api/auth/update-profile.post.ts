import { createError, readBody, getCookie } from "h3";
import { createDbClient } from "../../utils/db";
import { SESSION_COOKIE_NAME } from "../../utils/session";

const MAX_PHOTO_SIZE = 240;
const MAX_DATA_LENGTH = 100000; // ~100KB for base64 240x240 jpeg

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, SESSION_COOKIE_NAME);
  if (!sessionToken) {
    throw createError({ statusCode: 401, statusMessage: "Not authenticated." });
  }

  const body = await readBody(event);
  const profilePhoto = body?.profilePhoto; // base64 data URL

  const client = createDbClient();
  try {
    await client.connect();

    const sessionResult = await client.query(
      `SELECT user_id FROM app_sessions WHERE session_token = $1 AND expires_at > NOW()`,
      [sessionToken]
    );
    if (!sessionResult.rowCount) {
      throw createError({ statusCode: 401, statusMessage: "Session expired." });
    }
    const userId = sessionResult.rows[0].user_id;

    // Allow empty string to remove photo
    const photoStr = profilePhoto === undefined || profilePhoto === null
      ? null
      : String(profilePhoto).trim() || null;
    if (photoStr && photoStr.length > MAX_DATA_LENGTH) {
      throw createError({
        statusCode: 400,
        statusMessage: `Profile photo must be no larger than ${MAX_PHOTO_SIZE}x${MAX_PHOTO_SIZE} pixels.`,
      });
    }

    await client.query(
      `UPDATE app_users SET profile_photo = $1 WHERE user_id = $2`,
      [photoStr || null, userId]
    );

    return { success: true };
  } finally {
    await client.end().catch(() => undefined);
  }
});
