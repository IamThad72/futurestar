/** Shared support-email line for the on-screen page and the no-JS HTML. */

export const DEFAULT_SUPPORT_EMAIL = "support@me.com";
export const GENERAL_CONTACT_EMAIL = "info@me.com";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function resolveSupportEmail(value) {
  const email = String(value || "").trim();
  if (EMAIL.test(email)) return email;
  return DEFAULT_SUPPORT_EMAIL;
}

export function supportEmailContent(value) {
  return { email: resolveSupportEmail(value), before: "You can write to ", after: "." };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** One HTML rendering of the support line. The Vue page and the noscript copy both use it. */
export function supportEmailInnerHtml(value) {
  const content = supportEmailContent(value);
  return `${escapeHtml(content.before)}<a class="font-semibold text-navy underline underline-offset-2" href="mailto:${escapeHtml(content.email)}">${escapeHtml(content.email)}</a>${escapeHtml(content.after)}`;
}
