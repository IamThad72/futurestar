import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { verifyPassword } from "../../utils/password";
import { getSessionUserId } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const body = await readBody(event);
  const newEmail = String(body?.newEmail ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!newEmail || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: "New email and password are required.",
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
        statusMessage: "Use your account settings to change email (Supabase account).",
      });
    }
    if (!verifyPassword(password, user.password_hash)) {
      throw createError({
        statusCode: 400,
        statusMessage: "Password is incorrect.",
      });
    }

    const existingResult = await client.query(
      `SELECT 1 FROM app_users WHERE email = $1 AND user_id != $2`,
      [newEmail, userId]
    );
    if (existingResult.rowCount) {
      throw createError({
        statusCode: 400,
        statusMessage: "That email is already in use.",
      });
    }

    await client.query(
      `UPDATE app_users SET email = $1 WHERE user_id = $2`,
      [newEmail, userId]
    );

    return { success: true, email: newEmail };
  } finally {
    await client.end().catch(() => undefined);
  }
});
