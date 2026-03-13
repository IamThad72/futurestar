import { createError, getCookie, setCookie } from "h3";
import { createDbClient } from "../../utils/db";
import {
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "../../utils/session";

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    return { user: null };
  }

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

    if (!result.rowCount) {
      setCookie(event, SESSION_COOKIE_NAME, "", {
        ...getSessionCookieOptions(),
        maxAge: 0,
      });
      return { user: null };
    }

    return { user: result.rows[0] };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch session.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
