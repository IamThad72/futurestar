import { createError } from "h3";
import type { Client } from "pg";
import { parsePrayerInput, PRAYER_VIEWS } from "~/utils/prayerList.js";
import { isoDate } from "./faithPractices";

const COLUMNS = `prayer_id, title, notes, person, category, created_on::text AS created_on,
  answered_on::text AS answered_on, answer_note, archived_at, updated_at`;

function mapPrayer(row: Record<string, unknown>) {
  return {
    prayer_id: Number(row.prayer_id),
    title: String(row.title || ""),
    notes: row.notes ? String(row.notes) : "",
    person: row.person ? String(row.person) : "",
    category: row.category ? String(row.category) : "",
    created_on: isoDate(row.created_on),
    answered_on: isoDate(row.answered_on),
    answer_note: row.answer_note ? String(row.answer_note) : "",
    archived: Boolean(row.archived_at),
  };
}

export type PrayerRequest = ReturnType<typeof mapPrayer>;

/** Requests in one view: active (open), answered, or archived. Private: user_id only. */
export async function listPrayers(client: Client, userId: number, view: string, limit = 200) {
  const which = PRAYER_VIEWS.includes(view) ? view : "active";
  const filter =
    which === "archived"
      ? "archived_at IS NOT NULL"
      : which === "answered"
        ? "archived_at IS NULL AND answered_on IS NOT NULL"
        : "archived_at IS NULL AND answered_on IS NULL";
  const order = which === "answered" ? "answered_on DESC, prayer_id DESC" : which === "archived" ? "archived_at DESC" : "created_on DESC, prayer_id DESC";
  const result = await client.query(
    `SELECT ${COLUMNS} FROM prayer_requests WHERE user_id = $1 AND ${filter} ORDER BY ${order} LIMIT $2`,
    [userId, Math.max(1, Math.min(500, limit))],
  );
  return result.rows.map(mapPrayer);
}

export async function prayerCounts(client: Client, userId: number) {
  const result = await client.query(
    `SELECT
       count(*) FILTER (WHERE archived_at IS NULL AND answered_on IS NULL)::int AS active,
       count(*) FILTER (WHERE archived_at IS NULL AND answered_on IS NOT NULL)::int AS answered,
       count(*) FILTER (WHERE archived_at IS NOT NULL)::int AS archived
     FROM prayer_requests WHERE user_id = $1`,
    [userId],
  );
  const row = result.rows[0] || {};
  return { active: Number(row.active || 0), answered: Number(row.answered || 0), archived: Number(row.archived || 0) };
}

/**
 * A few open requests for Morning Prayer or the evening reflection. Rotates by
 * day so a long list is prayed through over the week.
 */
export async function prayersForToday(client: Client, userId: number, today: string, count = 3) {
  const result = await client.query(
    `SELECT ${COLUMNS} FROM prayer_requests
     WHERE user_id = $1 AND archived_at IS NULL AND answered_on IS NULL
     ORDER BY created_on DESC, prayer_id DESC
     LIMIT 100`,
    [userId],
  );
  const rows = result.rows.map(mapPrayer);
  if (rows.length <= count) return rows;
  const day = Math.floor(Date.parse(`${today}T00:00:00Z`) / 86_400_000) || 0;
  const start = ((day * count) % rows.length + rows.length) % rows.length;
  return Array.from({ length: count }, (_, offset) => rows[(start + offset) % rows.length]!);
}

export async function createPrayer(client: Client, userId: number, body: Record<string, unknown>, today: string) {
  const { value, error } = parsePrayerInput(
    { title: body.title, notes: body.notes, person: body.person, category: body.category },
    { requireTitle: true },
  );
  if (error) throw createError({ statusCode: 400, statusMessage: error });
  const result = await client.query(
    `INSERT INTO prayer_requests (user_id, title, notes, person, category, created_on)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNS}`,
    [userId, value.title, value.notes ?? null, value.person ?? null, value.category ?? null, today],
  );
  return mapPrayer(result.rows[0]);
}

/**
 * Edit or change a request. `action`: edit (default), answer, unanswer,
 * archive, unarchive. Answering takes { answered_on?, answer_note? }.
 */
export async function updatePrayer(client: Client, userId: number, prayerId: number, body: Record<string, unknown>, today: string) {
  const action = String(body.action || "edit");
  const sets: string[] = [];
  const params: unknown[] = [userId, prayerId];
  const add = (column: string, value: unknown) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };
  if (action === "edit" || action === "answer") {
    const fields: Record<string, unknown> = {};
    for (const key of ["title", "notes", "person", "category", "answer_note", "answered_on"]) {
      if (key in body) fields[key] = body[key];
    }
    const { value, error } = parsePrayerInput(fields);
    if (error) throw createError({ statusCode: 400, statusMessage: error });
    for (const [key, item] of Object.entries(value)) {
      if (key === "answered_on" && action === "answer") continue;
      add(key, item);
    }
    if (action === "answer") add("answered_on", value.answered_on || today);
  } else if (action === "unanswer") {
    add("answered_on", null);
    add("answer_note", null);
  } else if (action === "archive") {
    sets.push("archived_at = NOW()");
  } else if (action === "unarchive") {
    sets.push("archived_at = NULL");
  } else {
    throw createError({ statusCode: 400, statusMessage: "Unknown action." });
  }
  if (!sets.length) throw createError({ statusCode: 400, statusMessage: "Nothing to change." });
  const result = await client.query(
    `UPDATE prayer_requests SET ${sets.join(", ")}, updated_at = NOW()
     WHERE user_id = $1 AND prayer_id = $2
     RETURNING ${COLUMNS}`,
    params,
  );
  if (!result.rows[0]) throw createError({ statusCode: 404, statusMessage: "Prayer request not found." });
  return mapPrayer(result.rows[0]);
}

export async function deletePrayer(client: Client, userId: number, prayerId: number) {
  const result = await client.query(`DELETE FROM prayer_requests WHERE user_id = $1 AND prayer_id = $2`, [userId, prayerId]);
  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: "Prayer request not found." });
}
