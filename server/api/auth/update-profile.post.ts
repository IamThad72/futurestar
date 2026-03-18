import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";

const MAX_PHOTO_SIZE = 240;
const MAX_DATA_LENGTH = 100000; // ~100KB for base64 240x240 jpeg

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const body = await readBody(event);
  const profilePhoto = body?.profilePhoto; // base64 data URL

  const client = createDbClient();
  try {
    await client.connect();

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
