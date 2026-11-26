import { createError } from "h3";
import type { Client } from "pg";
import { addDays } from "~/utils/readingPlans.js";
import { normalizeAttendance, weekStartFor, worshipStreak } from "~/utils/worshipCheckin.js";
import { isoDate } from "./faithPractices";

const COLUMNS = `checkin_id, week_start::text AS week_start, attendance, church_name, sermon_passage, notes, takeaway`;

const LIMITS = { church_name: 120, sermon_passage: 120, notes: 4000, takeaway: 500 };

function mapCheckin(row: Record<string, unknown>) {
  return {
    checkin_id: Number(row.checkin_id),
    week_start: isoDate(row.week_start) || "",
    attendance: String(row.attendance || ""),
    church_name: row.church_name ? String(row.church_name) : "",
    sermon_passage: row.sermon_passage ? String(row.sermon_passage) : "",
    notes: row.notes ? String(row.notes) : "",
    takeaway: row.takeaway ? String(row.takeaway) : "",
  };
}

/** This week's check-in, the last 12 weeks, the streak and the church name used last time. */
export async function worshipOverview(client: Client, userId: number, today: string) {
  const week = weekStartFor(today);
  const result = await client.query(
    `SELECT ${COLUMNS} FROM worship_checkins
     WHERE user_id = $1 AND week_start <= $2
     ORDER BY week_start DESC LIMIT 60`,
    [userId, week],
  );
  const rows = result.rows.map(mapCheckin);
  const last = await client.query(
    `SELECT church_name FROM worship_checkins
     WHERE user_id = $1 AND church_name IS NOT NULL AND church_name <> ''
     ORDER BY week_start DESC LIMIT 1`,
    [userId],
  );
  const oldest = addDays(week, -7 * 11);
  return {
    week_start: week,
    current: rows.find((row) => row.week_start === week) || null,
    history: rows.filter((row) => row.week_start >= oldest),
    streak: worshipStreak(rows, today),
    last_church: last.rows[0]?.church_name ? String(last.rows[0].church_name) : "",
  };
}

function clean(value: unknown, max: number) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

/** Save (or with `clear: true`, remove) the check-in for a week. Defaults to this week. */
export async function saveCheckin(client: Client, userId: number, body: Record<string, unknown>, today: string) {
  const thisWeek = weekStartFor(today);
  const week = body.week_start ? weekStartFor(String(body.week_start)) : thisWeek;
  if (!week || week !== String(body.week_start || thisWeek)) {
    throw createError({ statusCode: 400, statusMessage: "week_start must be the Sunday that starts the week." });
  }
  if (week > thisWeek || week < addDays(thisWeek, -371)) {
    throw createError({ statusCode: 400, statusMessage: "You can check in for this week or the past year." });
  }
  if (body.clear === true) {
    await client.query(`DELETE FROM worship_checkins WHERE user_id = $1 AND week_start = $2`, [userId, week]);
    return;
  }
  const attendance = normalizeAttendance(body.attendance);
  if (!attendance) throw createError({ statusCode: 400, statusMessage: "Choose in person, online or not this week." });
  await client.query(
    `INSERT INTO worship_checkins (user_id, week_start, attendance, church_name, sermon_passage, notes, takeaway)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, week_start) DO UPDATE SET
       attendance = EXCLUDED.attendance,
       church_name = EXCLUDED.church_name,
       sermon_passage = EXCLUDED.sermon_passage,
       notes = EXCLUDED.notes,
       takeaway = EXCLUDED.takeaway,
       updated_at = NOW()`,
    [
      userId,
      week,
      attendance,
      clean(body.church_name, LIMITS.church_name),
      clean(body.sermon_passage, LIMITS.sermon_passage),
      clean(body.notes, LIMITS.notes),
      clean(body.takeaway, LIMITS.takeaway),
    ],
  );
}
