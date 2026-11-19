import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";

const MAX_DATA_LENGTH = 100000;

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
        statusMessage: "That photo is too large to save. Choose a smaller picture.",
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
