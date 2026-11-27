/**
 * Section-home headings that say the same thing as the short tab title.
 * Money and Body keep their Fraunces page title (28/34) on phones, so they
 * are not treated as duplicates of the smaller toolbar label.
 */
const HOME_HEADING_ALIASES = {
  "/spiritual": "faith",
};

const VISIBLE_PAGE_TITLE = new Set(["/financial", "/physical"]);

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
  const normalizedPath = String(path || "").replace(/\/+$/, "") || "/";
  if (VISIBLE_PAGE_TITLE.has(normalizedPath)) return false;
  const heading = normalizeTitle(headingText);
  if (!heading) return false;
  if (heading === normalizeTitle(screenTitle)) return true;
  const alias = HOME_HEADING_ALIASES[normalizedPath];
  return Boolean(alias && heading === alias);
}
