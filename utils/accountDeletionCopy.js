/** Shared wording for the delete screen and the public /delete-account page. */

export const ERASED_ON_DELETE = [
  "Budget lines, transactions, and estate records that belong only to you",
  "Estate documents you own",
  "Faith journals, prayers, and worship notes",
  "Nutrition and workouts",
  "Your profile, sessions, and sign-in",
];

export const KEPT_ON_DELETE =
  "Shared household money records stay with the household for as long as that household keeps them. If other people remain, those shared records are kept for them. If you are the owner and others remain, an owner who is already in the household is chosen before anyone else, and otherwise the person who joined next becomes the owner. If you are the only person, the household is deleted too.";

export const RETENTION_ON_DELETE =
  "Your private records are not kept after deletion. The sign-in id is kept so that sign-in cannot open a new account. If removing the sign-in does not finish immediately, we retry until it is gone. Your email is not stored on that marker.";

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
  return `<section id="delete-account-static"><h1>Delete your account</h1><h2>Erased</h2><ul>${items}</ul><h2>Stays with the household</h2><p>${escapeHtml(KEPT_ON_DELETE)}</p><h2>What is kept afterwards</h2><p>${escapeHtml(RETENTION_ON_DELETE)}</p><p><a href="/login?next=/delete-account">Sign in to delete your account</a></p></section>`;
}
