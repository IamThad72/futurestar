import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { hashPassword, verifyPassword } from "../../utils/password";
import { getSessionUserId } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const body = await readBody(event);
  const currentPassword = String(body?.currentPassword ?? "");
  const newPassword = String(body?.newPassword ?? "");

  if (!currentPassword || !newPassword) {
    throw createError({
      statusCode: 400,
      statusMessage: "Current password and new password are required.",
    });
  }

  if (newPassword.length < 8) {
    throw createError({
      statusCode: 400,
      statusMessage: "New password must be at least 8 characters.",
    });
  }

  const client = createDbClient();
  try {
    await client.connect();

    const userResult = await client.query(
      `SELECT password_hash FROM app_users WHERE user_id = $1`,
      [userId]
    );
    const user = userResult.rows[0];
    if (!user?.password_hash) {
      throw createError({
        statusCode: 400,
        statusMessage: "Use your account settings to change password (Supabase account).",
      });
    }
    if (!verifyPassword(currentPassword, user.password_hash)) {
      throw createError({
        statusCode: 400,
        statusMessage: "Current password is incorrect.",
      });
    }

    const passwordHash = hashPassword(newPassword);
    await client.query(
      `UPDATE app_users SET password_hash = $1 WHERE user_id = $2`,
      [passwordHash, userId]
    );

    return { success: true };
  } finally {
    await client.end().catch(() => undefined);
  }
});
