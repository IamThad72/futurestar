import { createError, readBody, setCookie } from "h3";
import { createDbClient } from "../../utils/db";
import { hashPassword } from "../../utils/password";
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
  const displayName = String(body?.display_name ?? "").trim();

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: "Email and password are required.",
    });
  }

  if (password.length < 8) {
    throw createError({
      statusCode: 400,
      statusMessage: "Password must be at least 8 characters.",
    });
  }

  const client = createDbClient();

  try {
    await client.connect();

    const existing = await client.query(
      "SELECT user_id FROM app_users WHERE email = $1",
      [email],
    );

    if (existing.rowCount) {
      throw createError({
        statusCode: 409,
        statusMessage: "An account with that email already exists.",
      });
    }

    const passwordHash = hashPassword(password);
    const result = await client.query(
      `INSERT INTO app_users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING user_id, email, display_name`,
      [email, passwordHash, displayName || null],
    );

    const sessionToken = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

    await client.query(
      `INSERT INTO app_sessions (session_token, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [sessionToken, result.rows[0].user_id, expiresAt],
    );

    setCookie(event, SESSION_COOKIE_NAME, sessionToken, getSessionCookieOptions());

    return {
      user: result.rows[0],
    };
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to register user.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
