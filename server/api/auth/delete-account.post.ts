import { createError, getHeader, getRequestIP, readBody, setCookie } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from "../../utils/session";
import {
  MULTIPLE_HOUSEHOLDS_MESSAGE,
  assertDeletionNotThrottled,
  assertSupabaseReauth,
  cleanupDeletedAccount,
  confirmAccountDeletion,
  deleteAccountInTransaction,
  deletionIpHash,
  recordDeletionFailure,
} from "../../utils/accountDeletion";
import { countUserGroups } from "../../utils/group";

function requestIp(event: Parameters<typeof getRequestIP>[0]) {
  // Vercel overwrites x-forwarded-for and sets x-vercel-forwarded-for to the
  // client address. Off Vercel, x-forwarded-for is whatever the caller sent.
  const vercel = getHeader(event, "x-vercel-forwarded-for");
  const fromVercel = vercel?.split(",")[0]?.trim();
  if (fromVercel) return fromVercel;
  return getRequestIP(event) || "unknown";
}

function bearerToken(event: Parameters<typeof getHeader>[0]) {
  const header = getHeader(event, "authorization");
  return header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

/**
 * Deletes the signed-in account only. A user id in the body is ignored.
 * The password is checked before the deletion transaction starts.
 */
export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const body = await readBody(event);
  const ipHash = deletionIpHash(requestIp(event));
  const client = createDbClient();
  let outcome = null;

  try {
    await client.connect();

    const preview = await client.query(
      `SELECT user_id, email, password_hash, supabase_user_id
       FROM app_users
       WHERE user_id = $1`,
      [userId],
    );
    const previewUser = preview.rows[0];
    if (!previewUser) {
      throw createError({ statusCode: 404, statusMessage: "Account not found." });
    }

    const households = await countUserGroups(client, userId);
    if (households > 1) {
      throw createError({ statusCode: 409, statusMessage: MULTIPLE_HOUSEHOLDS_MESSAGE });
    }

    const passwordHash =
      previewUser.password_hash == null || previewUser.password_hash === "" ? null : String(previewUser.password_hash);
    const supabaseUserId = previewUser.supabase_user_id == null ? null : String(previewUser.supabase_user_id);
    const token = bearerToken(event);
    if (!passwordHash && supabaseUserId && token) {
      await assertSupabaseReauth({
        email: String(previewUser.email ?? "").trim().toLowerCase(),
        password: String(body?.password ?? ""),
        bearerToken: token,
        checkPassword: false,
      });
    }

    await client.query("BEGIN");
    let denial: string | null = null;
    try {
      await assertDeletionNotThrottled(client, userId, ipHash);
      denial = confirmAccountDeletion({
        email: String(previewUser.email ?? ""),
        confirmEmail: body?.confirmEmail,
        password: body?.password,
        passwordHash,
      });
      if (!denial && !passwordHash && !supabaseUserId) {
        denial = "Enter your password to confirm.";
      }
      if (!denial && !passwordHash && supabaseUserId) {
        try {
          await assertSupabaseReauth({
            email: String(previewUser.email ?? "").trim().toLowerCase(),
            password: String(body?.password ?? ""),
            bearerToken: null,
          });
        } catch (error) {
          const statusCode =
            error && typeof error === "object" && "statusCode" in error
              ? Number((error as { statusCode?: number }).statusCode)
              : 0;
          if (statusCode !== 400) throw error;
          denial = "Enter your password to confirm.";
        }
      }
      if (denial === "Enter your password to confirm.") {
        await recordDeletionFailure(client, userId, ipHash);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
    if (denial) {
      throw createError({ statusCode: 400, statusMessage: denial });
    }

    await client.query("BEGIN");
    try {
      outcome = await deleteAccountInTransaction(client, userId, {
        confirmEmail: body?.confirmEmail,
        verifiedPasswordHash: passwordHash ?? "",
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) : 0;
    if (statusCode >= 400) {
      await client.end().catch(() => undefined);
      throw error;
    }
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : null;
    console.error("[auth/delete-account] failed", { code: code ?? null });
    await client.end().catch(() => undefined);
    throw createError({ statusCode: 500, statusMessage: "Could not delete the account." });
  }

  if (!outcome) {
    await client.end().catch(() => undefined);
    throw createError({ statusCode: 500, statusMessage: "Could not delete the account." });
  }

  let cleanup = { authUserRemoved: false, authRemovalPending: false };
  if (outcome) {
    try {
      cleanup = await cleanupDeletedAccount(client, outcome);
    } catch {
      console.error("[auth/delete-account] cleanup failed", { files: outcome.files.length });
      cleanup = {
        authUserRemoved: false,
        authRemovalPending: Boolean(outcome.supabaseUserId),
      };
    }
  }

  await client.end().catch(() => undefined);
  setCookie(event, SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });
  return { success: true, authUserRemoved: cleanup.authUserRemoved, authRemovalPending: cleanup.authRemovalPending };
});
