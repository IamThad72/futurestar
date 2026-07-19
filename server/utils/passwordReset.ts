import { createError, getHeader, type H3Event } from "h3";
import { createDbClient } from "./db";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { supabase } from "./superbase";

export const PASSWORD_RESET_SENT_MESSAGE =
  "If an account exists for that email, you will receive a password reset link shortly.";

export function resolvePasswordResetRedirectUrl(event: H3Event): string | undefined {
  const configured =
    process.env.NUXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    process.env.SITE_URL?.trim().replace(/\/$/, "");
  if (configured) {
    return `${configured}/reset-password`;
  }

  const origin = getHeader(event, "origin");
  if (origin) {
    return `${origin.replace(/\/$/, "")}/reset-password`;
  }

  return undefined;
}

type AppUserRow = {
  user_id: number;
  email: string;
  supabase_user_id: string | null;
  password_hash: string | null;
};

/**
 * Legacy accounts live only in app_users. Supabase does not send reset emails unless
 * the address exists in auth.users — provision (or link) before calling recover.
 */
export async function ensureSupabaseAuthForLegacyUser(
  appUser: AppUserRow,
): Promise<{ ok: boolean; reason?: string }> {
  if (appUser.supabase_user_id) {
    return { ok: true };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    console.warn(
      "[auth/password-reset] Legacy user needs Supabase Auth but SUPABASE_SERVICE_ROLE_KEY is not set:",
      appUser.email,
    );
    return { ok: false, reason: "missing_service_role" };
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: appUser.email,
    email_confirm: true,
  });

  let supabaseUserId = created?.user?.id ?? null;

  if (createError) {
    const alreadyExists =
      createError.message?.toLowerCase().includes("already") ||
      createError.message?.toLowerCase().includes("registered") ||
      (createError as { code?: string }).code === "email_exists";

    if (!alreadyExists) {
      console.error("[auth/password-reset] createUser failed:", createError.message);
      return { ok: false, reason: "create_failed" };
    }

    const { data: listed, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) {
      console.error("[auth/password-reset] listUsers failed:", listError.message);
      return { ok: false, reason: "list_failed" };
    }

    const match = listed?.users?.find(
      (u) => u.email?.trim().toLowerCase() === appUser.email,
    );
    supabaseUserId = match?.id ?? null;
    if (!supabaseUserId) {
      return { ok: false, reason: "user_not_in_auth" };
    }
  }

  const client = createDbClient();
  try {
    await client.connect();
    await client.query(
      `UPDATE app_users SET supabase_user_id = $1 WHERE user_id = $2 AND supabase_user_id IS NULL`,
      [supabaseUserId, appUser.user_id],
    );
  } finally {
    await client.end().catch(() => undefined);
  }

  return { ok: true };
}

export async function sendSupabasePasswordResetEmail(
  email: string,
  redirectTo: string | undefined,
): Promise<{ ok: boolean; errorMessage?: string }> {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );

  if (error) {
    return { ok: false, errorMessage: error.message };
  }
  return { ok: true };
}

export async function requestPasswordResetForEmail(
  event: H3Event,
  email: string,
): Promise<{ message: string }> {
  const redirectTo = resolvePasswordResetRedirectUrl(event);
  const client = createDbClient();

  let appUser: AppUserRow | null = null;
  try {
    await client.connect();
    const result = await client.query(
      `SELECT user_id, email, supabase_user_id, password_hash
       FROM app_users WHERE email = $1`,
      [email],
    );
    appUser = result.rows[0] ?? null;
  } finally {
    await client.end().catch(() => undefined);
  }

  if (!appUser) {
    return { message: PASSWORD_RESET_SENT_MESSAGE };
  }

  const needsLegacyProvision =
    appUser.password_hash && !appUser.supabase_user_id;

  if (needsLegacyProvision) {
    const provision = await ensureSupabaseAuthForLegacyUser(appUser);
    if (!provision.ok) {
      console.error(
        "[auth/password-reset] Could not provision Supabase Auth for",
        email,
        provision.reason,
      );
      throw createError({
        statusCode: 503,
        statusMessage:
          "Password reset is temporarily unavailable. Please contact support.",
      });
    }
  }

  const sent = await sendSupabasePasswordResetEmail(email, redirectTo);
  if (!sent.ok) {
    console.error("[auth/password-reset] resetPasswordForEmail:", sent.errorMessage);
    throw createError({
      statusCode: 500,
      statusMessage: sent.errorMessage || "Could not send reset email. Try again later.",
    });
  }

  return { message: PASSWORD_RESET_SENT_MESSAGE };
}
