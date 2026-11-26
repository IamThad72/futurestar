/** Section-home headings that say the same thing as the short tab title. */
const HOME_HEADING_ALIASES = {
  "/financial": "money",
  "/spiritual": "faith",
  "/physical": "body",
};

function normalizeTitle(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * True when a page heading repeats the toolbar title, so phones can show one
 * title instead of two.
 */
export function isDuplicateScreenTitle(headingText, screenTitle, path = "") {
  const heading = normalizeTitle(headingText);
  if (!heading) return false;
  if (heading === normalizeTitle(screenTitle)) return true;
  const alias = HOME_HEADING_ALIASES[String(path || "").replace(/\/+$/, "")];
  return Boolean(alias && heading === alias);
}
