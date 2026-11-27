import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { normalizeProfilePhoto } from "~/utils/profilePhoto.js";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const body = await readBody(event);
  const { photo, error } = normalizeProfilePhoto(body?.profilePhoto);
  if (error) {
    throw createError({ statusCode: 400, statusMessage: error });
  }

  const client = createDbClient();
  try {
    await client.connect();
    await client.query(
      `UPDATE app_users SET profile_photo = $1 WHERE user_id = $2`,
      [photo, userId]
    );

    return { success: true };
  } finally {
    await client.end().catch(() => undefined);
  }
});
