import { createError, readBody, setCookie } from "h3";
import { createDbClient } from "../../utils/db";
import { verifyPassword } from "../../utils/password";
import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "../../utils/session";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: "Email and password are required.",
    });
  }

  const client = createDbClient();

  try {
    await client.connect();

    const result = await client.query(
      `SELECT user_id, email, display_name, password_hash, profile_photo
       FROM app_users
       WHERE email = $1`,
      [email],
    );

    const user = result.rows[0];

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid email or password.",
      });
    }
    if (!user.password_hash) {
      throw createError({
        statusCode: 400,
        statusMessage: "This account uses Supabase sign-in. Please use the same email and password.",
      });
    }
    let passwordValid = false;
    try {
      passwordValid = verifyPassword(password, user.password_hash);
    } catch {
      // Malformed password_hash (e.g. different format) - treat as invalid
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid email or password.",
      });
    }
    if (!passwordValid) {
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid email or password.",
      });
    }

    const sessionToken = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

    await client.query(
      `INSERT INTO app_sessions (session_token, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [sessionToken, user.user_id, expiresAt],
    );

    setCookie(event, SESSION_COOKIE_NAME, sessionToken, getSessionCookieOptions());

    return {
      user: {
        user_id: user.user_id,
        email: user.email,
        display_name: user.display_name,
        profile_photo: user.profile_photo ?? null,
      },
    };
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }
    console.error("[auth/login]", error?.message ?? error, "DATABASE_URL host:", process.env.DATABASE_URL?.match(/@([^:]+)/)?.[1] ?? "unknown");
    throw createError({
      statusCode: 500,
      statusMessage: process.env.NODE_ENV === "development" && error?.message
        ? `Login failed: ${error.message}`
        : "Login failed.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
