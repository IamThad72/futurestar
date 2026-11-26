import { createError, getQuery } from "h3";
import type { H3Event } from "h3";

/** True when scripts/create_faith_common.sql has not run yet. */
export function practicesUnavailable(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code || "") : "";
  return code === "42P01" || code === "42703";
}

export const PRACTICES_SETUP_MESSAGE =
  "Reading plans, the prayer list and worship check-ins need their tables. Run scripts/create_faith_common.sql in Supabase (or npm run migrate).";

export function practicesSetupError() {
  return createError({ statusCode: 503, statusMessage: PRACTICES_SETUP_MESSAGE });
}

/** The person's local date (sent by the app), else the server date. */
export function clientToday(event: H3Event, bodyDate?: unknown) {
  const raw = String(bodyDate ?? getQuery(event).date ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) return raw;
  return isoDate(new Date()) as string;
}

export function parseId(value: unknown, label = "id") {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: `Invalid ${label}.` });
  return id;
}

export function isoDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

/** Rethrow HTTP errors, map a missing table to 503, everything else to 500. */
export function practicesError(error: unknown, message: string): never {
  if (error && typeof error === "object" && "statusCode" in error) throw error;
  if (practicesUnavailable(error)) throw practicesSetupError();
  console.error(message, error);
  throw createError({ statusCode: 500, statusMessage: message });
}
