/** Fiscal year the tax index should open. */
export function taxYearPath(date = new Date()) {
  const year = date instanceof Date ? date.getFullYear() : new Date(date).getFullYear();
  return `/tax/${year}`;
}
