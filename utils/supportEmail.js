/** Shared support-email line for the on-screen page and the no-JS HTML. */

export const SUPPORT_EMAIL_UNSET =
  "No support email is set. The owner adds one with NUXT_PUBLIC_SUPPORT_EMAIL. This page leaves the address out until then.";

export function supportEmailContent(value) {
  const email = String(value || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { email: "", before: SUPPORT_EMAIL_UNSET, after: "" };
  }
  return { email, before: "You can write to ", after: "." };
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
  if (!content.email) return escapeHtml(content.before);
  return `${escapeHtml(content.before)}<a class="font-semibold text-navy underline underline-offset-2" href="mailto:${escapeHtml(content.email)}">${escapeHtml(content.email)}</a>${escapeHtml(content.after)}`;
}
