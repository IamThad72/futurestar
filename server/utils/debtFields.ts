export function parseOptionalBoolean(value: unknown): boolean | null {
  if (value === undefined || value === null || value === "") return null;
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return null;
}

export function parseOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function parseOptionalInt(value: unknown): number | null {
  const n = parseOptionalNumber(value);
  if (n == null) return null;
  const i = Math.round(n);
  return Number.isFinite(i) ? i : null;
}

export function parseOptionalDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return s.slice(0, 10);
}
