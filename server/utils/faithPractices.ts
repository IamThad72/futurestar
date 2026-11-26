import { createError, getQuery } from "h3";
import type { H3Event } from "h3";
import { isRealIsoDate } from "~/utils/isoDate.js";

/** True when scripts/create_faith_common.sql has not run yet. */
export function practicesUnavailable(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code || "") : "";
  return code === "42P01" || code === "42703";
}

/** Shown to people using the app. The script path stays in the server log. */
export const PRACTICES_SETUP_MESSAGE =
  "Reading plans, the prayer list, and worship check-ins are not set up yet.";

const PRACTICES_SETUP_HINT =
  "Faith practices are not set up. Run scripts/create_faith_common.sql in Supabase (or npm run migrate).";

export function logPracticesSetup(error?: unknown) {
  console.error(PRACTICES_SETUP_HINT, error ?? "");
}

export function practicesSetupError(error?: unknown) {
  logPracticesSetup(error);
  return createError({ statusCode: 503, statusMessage: PRACTICES_SETUP_MESSAGE });
}

/**
 * How far a phone's calendar date may sit from the server date.
 * Time zones span at most about a day; two days leaves room for that
 * without letting a client pick an arbitrary streak or reading day.
 */
export const CLIENT_DATE_WINDOW_DAYS = 2;

function serverToday() {
  return isoDate(new Date()) as string;
}

function calendarDayNumber(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(year!, month! - 1, day!) / 86_400_000);
}

/**
 * The person's local date when the app sends a real YYYY-MM-DD close to the
 * server's date. Impossible days (2026-02-31, which `Date` rolls into March)
 * and dates outside the window are ignored, and the server date is used.
 * A body date wins over the query string; an unusable body date does not
 * fall through to the query.
 */
export function clientToday(event: H3Event, bodyDate?: unknown) {
  const raw = String(bodyDate ?? getQuery(event).date ?? "").trim();
  const today = serverToday();
  if (!isRealIsoDate(raw)) return today;
  if (Math.abs(calendarDayNumber(raw) - calendarDayNumber(today)) > CLIENT_DATE_WINDOW_DAYS) return today;
  return raw;
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
  if (practicesUnavailable(error)) throw practicesSetupError(error);
  console.error(message, error);
  throw createError({ statusCode: 500, statusMessage: message });
}
