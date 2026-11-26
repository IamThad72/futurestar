/**
 * A real calendar day in YYYY-MM-DD form.
 * `Date.parse("2026-02-31")` does not return NaN: it rolls forward to March 3.
 * Compare the calendar parts instead of trusting that parse.
 */
export function isRealIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 100) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}
