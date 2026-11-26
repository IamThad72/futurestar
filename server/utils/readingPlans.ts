import { createError } from "h3";
import type { Client } from "pg";
import {
  addDays,
  dateForDay,
  dayCitation,
  planDayReadings,
  planProgress,
  plansForTradition,
  readingPlan,
  rescheduledStart,
  suggestedStart,
} from "~/utils/readingPlans.js";
import { includesDeuterocanon } from "~/utils/faithProfile.js";
import type { FaithProfile } from "./faithProfile";
import { isoDate, practicesUnavailable } from "./faithPractices";
import { isRealIsoDate } from "~/utils/isoDate.js";

type EnrollmentRow = {
  user_plan_id: number;
  plan_key: string;
  start_on: string;
  include_deuterocanon: boolean;
  status: "active" | "completed" | "stopped";
  completed_at: string | null;
};

type Progress = ReturnType<typeof planProgress>;

type Reading = { citation: string; book: string; segments: { chapter: number; start: number | null; end: number | null }[] };

const ENROLLMENT_COLUMNS = `user_plan_id, plan_key, start_on::text AS start_on, include_deuterocanon, status, completed_at`;

function mapEnrollment(row: Record<string, unknown>): EnrollmentRow {
  return {
    user_plan_id: Number(row.user_plan_id),
    plan_key: String(row.plan_key),
    start_on: isoDate(row.start_on) || "",
    include_deuterocanon: Boolean(row.include_deuterocanon),
    status: String(row.status) as EnrollmentRow["status"],
    completed_at: row.completed_at ? new Date(String(row.completed_at)).toISOString() : null,
  };
}

/** The library as offered to this person (Catholic-only plans are hidden elsewhere). */
export function planLibrary(profile: FaithProfile, today: string) {
  return plansForTradition(profile.tradition).map((plan) => ({
    key: plan.key,
    name: plan.name,
    description: plan.description,
    length: plan.length,
    season: plan.season || null,
    suggested_start: suggestedStart(plan, today, { tradition: profile.tradition }),
    first_day: dayCitation(planDayReadings(plan.key, 1, { includeDeuterocanon: includesDeuterocanon(profile.tradition) })),
  }));
}

async function loadEntries(client: Client, userId: number, userPlanIds: number[]) {
  const byPlan = new Map<number, Map<number, string>>();
  for (const id of userPlanIds) byPlan.set(id, new Map());
  if (!userPlanIds.length) return byPlan;
  const result = await client.query(
    `SELECT user_plan_id, day_number, status
     FROM user_reading_progress
     WHERE user_id = $1 AND user_plan_id = ANY($2::int[])`,
    [userId, userPlanIds],
  );
  for (const row of result.rows) {
    byPlan.get(Number(row.user_plan_id))?.set(Number(row.day_number), String(row.status));
  }
  return byPlan;
}

/**
 * The day to show now: today's scheduled day while it is unread, else the next
 * unread day (reading ahead), else nothing when the plan is finished.
 */
export function focusDay(progress: Progress) {
  if (progress.finished) return null;
  if (progress.notStarted) return 1;
  if (!progress.todayDone) return progress.scheduledDay;
  return progress.nextDay;
}

function summarize(row: EnrollmentRow, entries: Map<number, string>, today: string) {
  const plan = readingPlan(row.plan_key);
  if (!plan) return null;
  const progress = planProgress({ length: plan.length, startOn: row.start_on, today, entries });
  const day = focusDay(progress);
  const options = { includeDeuterocanon: row.include_deuterocanon };
  return {
    user_plan_id: row.user_plan_id,
    plan_key: row.plan_key,
    name: plan.name,
    length: plan.length,
    start_on: row.start_on,
    status: row.status,
    include_deuterocanon: row.include_deuterocanon,
    completed_at: row.completed_at,
    progress,
    focus_day: day,
    focus_date: day ? dateForDay(row.start_on, day) : null,
    focus_citation: day ? dayCitation(planDayReadings(row.plan_key, day, options)) : "",
  };
}

export type PlanSummary = NonNullable<ReturnType<typeof summarize>>;

/** Running plans plus the last few finished or stopped ones. */
export async function listEnrollments(client: Client, userId: number, today: string, { activeOnly = false } = {}) {
  const result = await client.query(
    `SELECT ${ENROLLMENT_COLUMNS}
     FROM user_reading_plans
     WHERE user_id = $1 ${activeOnly ? "AND status = 'active'" : ""}
     ORDER BY (status = 'active') DESC, updated_at DESC
     LIMIT 20`,
    [userId],
  );
  const rows = result.rows.map(mapEnrollment);
  const entries = await loadEntries(client, userId, rows.map((row) => row.user_plan_id));
  return rows
    .map((row) => summarize(row, entries.get(row.user_plan_id) || new Map(), today))
    .filter((item): item is PlanSummary => Boolean(item));
}

async function loadEnrollment(client: Client, userId: number, userPlanId: number) {
  const result = await client.query(
    `SELECT ${ENROLLMENT_COLUMNS} FROM user_reading_plans WHERE user_id = $1 AND user_plan_id = $2`,
    [userId, userPlanId],
  );
  if (!result.rows[0]) throw createError({ statusCode: 404, statusMessage: "Reading plan not found." });
  const row = mapEnrollment(result.rows[0]);
  const plan = readingPlan(row.plan_key);
  if (!plan) throw createError({ statusCode: 404, statusMessage: "That reading plan is no longer offered." });
  return { row, plan };
}

/** One enrollment with every day's citation and status. */
export async function getEnrollmentDetail(client: Client, userId: number, userPlanId: number, today: string) {
  const { row, plan } = await loadEnrollment(client, userId, userPlanId);
  const entries = (await loadEntries(client, userId, [userPlanId])).get(userPlanId) || new Map();
  const summary = summarize(row, entries, today)!;
  const options = { includeDeuterocanon: row.include_deuterocanon };
  const days = Array.from({ length: plan.length }, (_, index) => {
    const day = index + 1;
    return {
      day,
      date: dateForDay(row.start_on, day),
      citation: dayCitation(planDayReadings(plan.key, day, options)),
      status: (entries.get(day) as "done" | "skipped" | undefined) || null,
    };
  });
  return { plan: summary, description: plan.description, days };
}

/** The readings (references only) for one day of an enrollment. */
export async function enrollmentDayReadings(client: Client, userId: number, userPlanId: number, day: number) {
  const { row, plan } = await loadEnrollment(client, userId, userPlanId);
  if (!Number.isInteger(day) || day < 1 || day > plan.length) {
    throw createError({ statusCode: 400, statusMessage: `Day must be between 1 and ${plan.length}.` });
  }
  const entries = (await loadEntries(client, userId, [userPlanId])).get(userPlanId) || new Map();
  return {
    row,
    plan,
    status: (entries.get(day) as string | undefined) || null,
    readings: planDayReadings(plan.key, day, { includeDeuterocanon: row.include_deuterocanon }) as Reading[],
  };
}

function validStart(startOn: unknown, today: string) {
  const text = String(startOn || "").trim();
  if (!isRealIsoDate(text)) {
    throw createError({ statusCode: 400, statusMessage: "Choose a start date." });
  }
  if (text < addDays(today, -400) || text > addDays(today, 400)) {
    throw createError({ statusCode: 400, statusMessage: "Choose a start date within about a year of today." });
  }
  return text;
}

export async function startPlan(
  client: Client,
  userId: number,
  profile: FaithProfile,
  body: Record<string, unknown>,
  today: string,
) {
  const plan = readingPlan(body.plan_key);
  const offered = plansForTradition(profile.tradition).some((item) => item.key === plan?.key);
  if (!plan || !offered) throw createError({ statusCode: 400, statusMessage: "Choose a reading plan from the list." });
  const startOn = validStart(body.start_on || suggestedStart(plan, today, { tradition: profile.tradition }), today);
  const includeDc = Boolean(plan.catholicOnly) || includesDeuterocanon(profile.tradition);
  try {
    const result = await client.query(
      `INSERT INTO user_reading_plans (user_id, plan_key, start_on, include_deuterocanon)
       VALUES ($1, $2, $3, $4)
       RETURNING user_plan_id`,
      [userId, plan.key, startOn, includeDc],
    );
    return Number(result.rows[0].user_plan_id);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : "";
    if (code === "23505") {
      throw createError({ statusCode: 409, statusMessage: `You are already reading ${plan.name}.` });
    }
    throw error;
  }
}

async function refreshCompletion(client: Client, userId: number, userPlanId: number, length: number) {
  const count = await client.query(
    `SELECT count(*)::int AS handled FROM user_reading_progress WHERE user_id = $1 AND user_plan_id = $2 AND day_number <= $3`,
    [userId, userPlanId, length],
  );
  const finished = Number(count.rows[0]?.handled || 0) >= length;
  if (finished) {
    await client.query(
      `UPDATE user_reading_plans SET status = 'completed', completed_at = COALESCE(completed_at, NOW()), updated_at = NOW()
       WHERE user_id = $1 AND user_plan_id = $2 AND status = 'active'`,
      [userId, userPlanId],
    );
  } else {
    // Un-marking a day re-opens a finished plan (unless another copy is running).
    await client.query(
      `UPDATE user_reading_plans p SET status = 'active', completed_at = NULL, updated_at = NOW()
       WHERE p.user_id = $1 AND p.user_plan_id = $2 AND p.status = 'completed'
         AND NOT EXISTS (
           SELECT 1 FROM user_reading_plans o
           WHERE o.user_id = p.user_id AND o.plan_key = p.plan_key AND o.status = 'active'
         )`,
      [userId, userPlanId],
    );
    await client.query(
      `UPDATE user_reading_plans SET updated_at = NOW() WHERE user_id = $1 AND user_plan_id = $2`,
      [userId, userPlanId],
    );
  }
}

/** Mark one day done or skipped, or clear it. */
export async function markDay(client: Client, userId: number, userPlanId: number, day: number, status: string, today: string) {
  const { plan } = await loadEnrollment(client, userId, userPlanId);
  if (!Number.isInteger(day) || day < 1 || day > plan.length) {
    throw createError({ statusCode: 400, statusMessage: `Day must be between 1 and ${plan.length}.` });
  }
  if (status === "clear") {
    await client.query(
      `DELETE FROM user_reading_progress WHERE user_id = $1 AND user_plan_id = $2 AND day_number = $3`,
      [userId, userPlanId, day],
    );
  } else if (status === "done" || status === "skipped") {
    await client.query(
      `INSERT INTO user_reading_progress (user_plan_id, user_id, day_number, status, marked_on)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_plan_id, day_number) DO UPDATE SET status = EXCLUDED.status, marked_on = EXCLUDED.marked_on`,
      [userPlanId, userId, day, status, today],
    );
  } else {
    throw createError({ statusCode: 400, statusMessage: "Status must be done, skipped or clear." });
  }
  await refreshCompletion(client, userId, userPlanId, plan.length);
}

/**
 * Plan-level actions:
 * - skip_missed: mark every missed day before today as skipped (catch up to today)
 * - reschedule:  move the start date so the next unread day is today
 * - stop / resume: pause a plan or pick it back up
 * - restart:     start again from day 1 today (clears progress)
 */
export async function updatePlan(client: Client, userId: number, userPlanId: number, action: string, today: string) {
  const { row, plan } = await loadEnrollment(client, userId, userPlanId);
  const entries = (await loadEntries(client, userId, [userPlanId])).get(userPlanId) || new Map();
  const progress = planProgress({ length: plan.length, startOn: row.start_on, today, entries });
  if (action === "skip_missed") {
    if (progress.missed.length) {
      await client.query(
        `INSERT INTO user_reading_progress (user_plan_id, user_id, day_number, status, marked_on)
         SELECT $1, $2, d, 'skipped', $4 FROM unnest($3::int[]) AS d
         ON CONFLICT (user_plan_id, day_number) DO NOTHING`,
        [userPlanId, userId, progress.missed, today],
      );
    }
    await refreshCompletion(client, userId, userPlanId, plan.length);
    return;
  }
  if (action === "reschedule") {
    if (!progress.nextDay) return;
    await client.query(
      `UPDATE user_reading_plans SET start_on = $3, updated_at = NOW() WHERE user_id = $1 AND user_plan_id = $2`,
      [userId, userPlanId, rescheduledStart(today, progress.nextDay)],
    );
    return;
  }
  if (action === "stop") {
    await client.query(
      `UPDATE user_reading_plans SET status = 'stopped', updated_at = NOW() WHERE user_id = $1 AND user_plan_id = $2 AND status = 'active'`,
      [userId, userPlanId],
    );
    return;
  }
  if (action === "resume" || action === "restart") {
    if (row.status !== "active") {
      const running = await client.query(
        `SELECT 1 FROM user_reading_plans WHERE user_id = $1 AND plan_key = $2 AND status = 'active' AND user_plan_id <> $3`,
        [userId, row.plan_key, userPlanId],
      );
      if (running.rows.length) throw createError({ statusCode: 409, statusMessage: `You are already reading ${plan.name}.` });
    }
    if (action === "restart") {
      await client.query(`DELETE FROM user_reading_progress WHERE user_id = $1 AND user_plan_id = $2`, [userId, userPlanId]);
    }
    // Resuming keeps your place: the next unread day becomes today.
    const startOn = action === "restart" ? today : rescheduledStart(today, progress.nextDay || 1);
    await client.query(
      `UPDATE user_reading_plans SET status = 'active', start_on = $3, completed_at = NULL, updated_at = NOW()
       WHERE user_id = $1 AND user_plan_id = $2`,
      [userId, userPlanId, startOn],
    );
    return;
  }
  throw createError({ statusCode: 400, statusMessage: "Unknown action." });
}

/** For the "Today's reading" card: running plans only, or `unavailable` before the SQL has run. */
export async function todaysReadings(client: Client, userId: number, today: string) {
  try {
    return { unavailable: false, plans: await listEnrollments(client, userId, today, { activeOnly: true }) };
  } catch (error) {
    if (practicesUnavailable(error)) return { unavailable: true, plans: [] as PlanSummary[] };
    throw error;
  }
}

