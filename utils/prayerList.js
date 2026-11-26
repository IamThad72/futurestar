/** Prayer list: categories and input checks shared by the screen and the API. */
import { isRealIsoDate } from "./isoDate.js";

export const PRAYER_CATEGORIES = ["Family", "Friends", "Church", "Work", "Health", "World", "Myself", "Other"];

export const PRAYER_VIEWS = ["active", "answered", "archived"];

export const PRAYER_LIMITS = { title: 200, notes: 2000, person: 120, answer_note: 2000 };

function clean(value, max) {
  const text = String(value ?? "").trim();
  return text.length > max ? text.slice(0, max) : text;
}

/**
 * Clean a prayer request from a form. Returns { value, error }.
 * Only keys present in `input` are returned (so it works for edits).
 */
export function parsePrayerInput(input, { requireTitle = false } = {}) {
  const source = input && typeof input === "object" ? input : {};
  const value = {};
  if ("title" in source || requireTitle) {
    value.title = clean(source.title, PRAYER_LIMITS.title);
    if (!value.title) return { value, error: "Give the request a short title." };
  }
  if ("notes" in source) value.notes = clean(source.notes, PRAYER_LIMITS.notes) || null;
  if ("person" in source) value.person = clean(source.person, PRAYER_LIMITS.person) || null;
  if ("category" in source) {
    const category = clean(source.category, 40);
    if (category && !PRAYER_CATEGORIES.includes(category)) return { value, error: "Choose a category from the list." };
    value.category = category || null;
  }
  if ("answer_note" in source) value.answer_note = clean(source.answer_note, PRAYER_LIMITS.answer_note) || null;
  if ("answered_on" in source) {
    const date = source.answered_on == null || source.answered_on === "" ? null : String(source.answered_on).trim();
    if (date && !isRealIsoDate(date)) return { value, error: "Answered date must be YYYY-MM-DD." };
    value.answered_on = date;
  }
  return { value, error: "" };
}

/**
 * True when any row is already confirming a delete. The id is list-wide:
 * a different prayer must not open a second alert. Zero means the list is idle.
 */
export function prayerConfirmOpen(busyId) {
  const id = Number(busyId);
  return Number.isFinite(id) && id !== 0;
}

/** Which view a request belongs to. */
export function prayerView(row) {
  if (row?.archived_at) return "archived";
  if (row?.answered_on) return "answered";
  return "active";
}
