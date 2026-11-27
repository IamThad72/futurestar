/** Shared wording for the delete screen and the public /delete-account page. */

export const ERASED_ON_DELETE = [
  "Budget lines, transactions, and estate records that belong only to you",
  "Estate documents you own",
  "Faith journals, prayers, and worship notes",
  "Nutrition and workouts",
  "Your profile, sessions, and sign-in",
];

export const KEPT_ON_DELETE =
  "Shared household money stays with the household. Household tax profiles and deduction overrides stay too. If one of your shared income, investment, or savings sources has the same name as one a remaining person already has, your copy is kept and renamed with \" (former member)\". If that name is taken, a number is added, such as \" (former member) 2\". Transactions stay linked to your renamed source. If other people remain, those shared records are kept for them. If you are the owner and others remain, an owner who is already in the household is chosen before anyone else, and otherwise the person who joined next becomes the owner. If you are the only person, the household is deleted, including household rows that still name someone who already left. Those rows are not turned into private records.";

export const RETENTION_ON_DELETE =
  "Your private records are not kept after deletion, except private asset, vehicle, and cash or investment accounts that are not in a household. Those stay for 90 days, including the holdings on a private cash or investment account and the service history on a private vehicle. They are not shown in the app, and a daily job then deletes them. Shared household copies of those records, including shared holdings and service history, stay with the household. The sign-in id is kept so that sign-in cannot open a new account. If removing the sign-in does not finish immediately, a daily job retries until it is gone. Your email is not stored on that marker.";

export const PASSWORDLESS_HINT =
  "If this account has no password, open Sign in and choose Forgot password. That uses the email Supabase already sends, and sets a password. Then come back and enter it. This app does not add another email service.";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** HTML for /delete-account that is present before JavaScript runs. */
export function deleteAccountStaticHtml() {
  const items = ERASED_ON_DELETE.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<section id="delete-account-static"><h1>Delete your account</h1><h2>Erased</h2><ul>${items}</ul><h2>Stays with the household</h2><p>${escapeHtml(KEPT_ON_DELETE)}</p><h2>What is kept afterwards</h2><p>${escapeHtml(RETENTION_ON_DELETE)}</p><p>${escapeHtml(PASSWORDLESS_HINT)}</p><p><a href="/login?next=/delete-account">Sign in to delete your account</a></p></section>`;
}
