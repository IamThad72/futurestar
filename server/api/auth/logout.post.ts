import { getCookie, setCookie } from "h3";
import { createDbClient } from "../../utils/db";
import {
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "../../utils/session";

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    return { success: true };
  }

  const client = createDbClient();

  try {
    await client.connect();
    await client.query("DELETE FROM app_sessions WHERE session_token = $1", [
      sessionToken,
    ]);
  } finally {
    await client.end().catch(() => undefined);
  }

  setCookie(event, SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });

  return { success: true };
});
