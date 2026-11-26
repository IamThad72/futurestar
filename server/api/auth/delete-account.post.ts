import { createError, readBody, setCookie } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from "../../utils/session";
import { cleanupDeletedAccount, deleteAccountInTransaction } from "../../utils/accountDeletion";

/**
 * Deletes the signed-in account only. A user id in the body is ignored, so
 * one person cannot delete another person's account.
 */
export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const body = await readBody(event);
  const client = createDbClient();
  let outcome = null;

  try {
    await client.connect();
    await client.query("BEGIN");
    try {
      outcome = await deleteAccountInTransaction(client, userId, {
        confirmEmail: body?.confirmEmail,
        password: body?.password,
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) : 0;
    if (statusCode >= 400 && statusCode < 500) throw error;
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : null;
    console.error("[auth/delete-account] failed", { userId, code: code ?? null });
    throw createError({ statusCode: 500, statusMessage: "Could not delete the account." });
  } finally {
    await client.end().catch(() => undefined);
  }

  const authUserRemoved = outcome ? await cleanupDeletedAccount(outcome) : false;
  setCookie(event, SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });
  return { success: true, authUserRemoved };
});
