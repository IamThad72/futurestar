import { createError, getHeader } from "h3";
import { createDbClient } from "../../utils/db";
import { supabase } from "../../utils/superbase";

/**
 * Links a Supabase Auth user to app_users. Call this after sign-in/sign-up with Supabase.
 * - If app_user exists for this supabase_user_id, returns it.
 * - Otherwise creates a new app_user (email from JWT, password_hash = null).
 *
 * Requires: Authorization: Bearer <supabase_access_token>
 */
export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, "authorization");
  const jwt = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!jwt) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authorization Bearer token required.",
    });
  }

  const {
    data: { user: supabaseUser },
    error: authError,
  } = await supabase.auth.getUser(jwt);

  if (authError || !supabaseUser?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid or expired token.",
    });
  }

  const email =
    (supabaseUser.email ?? supabaseUser.user_metadata?.email)?.trim().toLowerCase() || null;
  const displayName =
    supabaseUser.user_metadata?.display_name ??
    supabaseUser.user_metadata?.full_name ??
    null;

  if (!email) {
    throw createError({
      statusCode: 400,
      statusMessage: "User has no email. Email is required.",
    });
  }

  const client = createDbClient();

  try {
    await client.connect();

    // Check if already linked
    const existing = await client.query(
      `SELECT user_id, email, display_name, profile_photo
       FROM app_users
       WHERE supabase_user_id = $1`,
      [supabaseUser.id],
    );

    if (existing.rows[0]) {
      return { user: existing.rows[0] };
    }

    // Check if email exists (e.g. migrated user) - link by adding supabase_user_id
    const byEmail = await client.query(
      `SELECT user_id, email, display_name, profile_photo
       FROM app_users
       WHERE email = $1`,
      [email],
    );

    if (byEmail.rows[0]) {
      await client.query(
        `UPDATE app_users SET supabase_user_id = $1 WHERE user_id = $2`,
        [supabaseUser.id, byEmail.rows[0].user_id],
      );
      return { user: byEmail.rows[0] };
    }

    // Create new app_user for this Supabase user
    const insert = await client.query(
      `INSERT INTO app_users (email, password_hash, display_name, supabase_user_id)
       VALUES ($1, NULL, $2, $3)
       RETURNING user_id, email, display_name, profile_photo`,
      [email, displayName || null, supabaseUser.id],
    );

    return { user: insert.rows[0] };
  } catch (err) {
    if (err?.statusCode) throw err;
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to link user.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
