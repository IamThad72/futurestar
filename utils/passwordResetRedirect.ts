/**
 * URL Supabase redirects to after the user clicks the reset link in email.
 * Must be listed under Authentication → URL configuration → Redirect URLs in Supabase.
 */
export function getPasswordResetRedirectUrl(): string {
  if (!import.meta.client) {
    return "";
  }
  const origin = window.location.origin.replace(/\/$/, "");
  const config = useRuntimeConfig().public;
  const path = "/reset-password";
  if (config.isCapacitorBuild) {
    return `${origin}/#${path}`;
  }
  return `${origin}${path}`;
}
