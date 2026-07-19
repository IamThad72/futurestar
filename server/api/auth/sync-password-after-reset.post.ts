import { createError, getHeader, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { hashPassword } from "../../utils/password";
import { supabase } from "../../utils/superbase";

/**
 * After Supabase password recovery, keep legacy app_users.password_hash in sync
 * so web login (legacy cookie path) uses the same password.
 */
export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, "authorization");
  const jwt = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!jwt) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized." });
  }

  const body = await readBody(event);
  const newPassword = String(body?.newPassword ?? "");
  if (newPassword.length < 8) {
    throw createError({
      statusCode: 400,
      statusMessage: "Password must be at least 8 characters.",
    });
  }

  const {
    data: { user: supabaseUser },
    error: authError,
  } = await supabase.auth.getUser(jwt);

  if (authError || !supabaseUser?.id) {
    throw createError({ statusCode: 401, statusMessage: "Invalid or expired session." });
  }

  const client = createDbClient();
  try {
    await client.connect();

    const result = await client.query(
      `SELECT user_id, password_hash FROM app_users WHERE supabase_user_id = $1`,
      [supabaseUser.id],
    );
    const row = result.rows[0];
    if (!row?.password_hash) {
      return { success: true, synced: false };
    }

    const passwordHash = hashPassword(newPassword);
    await client.query(`UPDATE app_users SET password_hash = $1 WHERE user_id = $2`, [
      passwordHash,
      row.user_id,
    ]);

    return { success: true, synced: true };
  } finally {
    await client.end().catch(() => undefined);
  }
});
