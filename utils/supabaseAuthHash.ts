/** Parse Supabase auth redirect params from the URL hash or query string. */
export function parseSupabaseAuthParams(): {
  type: string | null;
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
  hasAccessToken: boolean;
} {
  if (!import.meta.client) {
    return {
      type: null,
      error: null,
      errorCode: null,
      errorDescription: null,
      hasAccessToken: false,
    };
  }

  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash || window.location.search);

  return {
    type: params.get("type"),
    error: params.get("error"),
    errorCode: params.get("error_code"),
    errorDescription: params.get("error_description")?.replace(/\+/g, " ") ?? null,
    hasAccessToken: params.has("access_token"),
  };
}

export function isPasswordRecoveryRedirect(): boolean {
  const { type, hasAccessToken, error } = parseSupabaseAuthParams();
  if (error) return false;
  return type === "recovery" || hasAccessToken;
}

export function formatSupabaseAuthError(
  errorCode: string | null,
  errorDescription: string | null,
): string {
  if (errorCode === "otp_expired") {
    return "This reset link has expired. Request a new one from the sign-in page (links are single-use and time-limited).";
  }
  if (errorDescription) {
    return errorDescription;
  }
  return "This reset link is invalid or has expired. Request a new link from the sign-in page.";
}
