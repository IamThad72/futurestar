import { createError, getCookie, getHeader } from "h3";
import type { H3Event } from "h3";
import { createDbClient } from "./db";
import { SESSION_COOKIE_NAME } from "./session";

/** User shape returned by getSessionUserOrNull */
export interface SessionUser {
  user_id: number;
  email: string;
  display_name: string | null;
  profile_photo: string | null;
}

/**
 * Returns the current app user if authenticated (JWT or session), else null.
 * Use for /api/auth/me and other endpoints that need to return null when unauthenticated.
 */
export async function getSessionUserOrNull(
  event: H3Event,
): Promise<SessionUser | null> {
  const authHeader = getHeader(event, "authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (bearerToken) {
    const user = await getUserFromSupabaseJwt(event, bearerToken);
    if (user) return user;
  }

  const sessionToken = getCookie(event, SESSION_COOKIE_NAME);
  if (sessionToken) {
    const user = await getUserFromSessionToken(sessionToken);
    if (user) return user;
  }

  return null;
}

async function getUserFromSupabaseJwt(
  event: H3Event,
  jwt: string,
): Promise<SessionUser | null> {
  try {
    const { supabase } = await import("./superbase");
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(jwt);

    if (error || !user?.id) return null;

    const client = createDbClient();
    try {
      await client.connect();
      const result = await client.query(
        `SELECT user_id, email, display_name, profile_photo
         FROM app_users WHERE supabase_user_id = $1`,
        [user.id],
      );
      const row = result.rows[0];
      return row
        ? {
            user_id: row.user_id,
            email: row.email,
            display_name: row.display_name ?? null,
            profile_photo: row.profile_photo ?? null,
          }
        : null;
    } finally {
      await client.end().catch(() => undefined);
    }
  } catch {
    return null;
  }
}

async function getUserFromSessionToken(
  sessionToken: string,
): Promise<SessionUser | null> {
  const client = createDbClient();
  try {
    await client.connect();
    const result = await client.query(
      `SELECT u.user_id, u.email, u.display_name, u.profile_photo
       FROM app_sessions s
       JOIN app_users u ON u.user_id = s.user_id
       WHERE s.session_token = $1 AND s.expires_at > NOW()`,
      [sessionToken],
    );
    const row = result.rows[0];
    return row
      ? {
          user_id: row.user_id,
          email: row.email,
          display_name: row.display_name ?? null,
          profile_photo: row.profile_photo ?? null,
        }
      : null;
  } catch {
    return null;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * Resolves the current app user_id from either:
 * 1. Supabase JWT (Authorization: Bearer <token>) - links via app_users.supabase_user_id
 * 2. Legacy session cookie (app_sessions)
 *
 * Use this in all protected API routes instead of manually checking app_sessions.
 * Keeps app_users and groups unchanged - only the auth mechanism differs.
 */
export async function getSessionUserId(event: H3Event): Promise<number> {
  const user = await getSessionUserOrNull(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "You must be logged in.",
    });
  }
  return user.user_id;
}
