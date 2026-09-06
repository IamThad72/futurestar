import { createError } from "h3";
import type { Client } from "pg";
import { exerciseGifUrl } from "./exerciseDb";
import { ensureLocalFeaturedEndurance } from "./exerciseCatalog";
import { privateUserClause, privateUserClauseAt } from "./privateUserAccess";
import { getWorkoutById, parseWorkoutNotes } from "./workouts";

export type JournalLogMode = "reps" | "duration";

export type JournalSetDto = {
  journalSetId: number;
  sortOrder: number;
  reps: number | null;
  weight: number | null;
  weightUnit: "lb" | "kg";
  durationSeconds: number | null;
  restSeconds: number | null;
  notes: string | null;
};

export type JournalExerciseDto = {
  journalExerciseId: number;
  exerciseId: string | null;
  exerciseName: string;
  equipmentKey: string | null;
  gifUrl: string | null;
  logMode: JournalLogMode;
  sortOrder: number;
  notes: string | null;
  sets: JournalSetDto[];
};

export type JournalSessionSummary = {
  sessionId: number;
  workoutId: number | null;
  workoutName: string | null;
  name: string | null;
  notes: string | null;
  source: "workout" | "custom";
  performedAt: string;
  exerciseCount: number;
  setCount: number;
  createdAt: string;
  updatedAt: string;
};

export type JournalSessionDetail = {
  sessionId: number;
  workoutId: number | null;
  workoutName: string | null;
  name: string | null;
  notes: string | null;
  source: "workout" | "custom";
  performedAt: string;
  createdAt: string;
  updatedAt: string;
  exercises: JournalExerciseDto[];
};

export type JournalSetInput = {
  reps: number | null;
  weight: number | null;
  weightUnit: "lb" | "kg";
  durationSeconds: number | null;
  restSeconds: number | null;
  notes: string | null;
};

export type JournalExerciseInput = {
  exerciseId: string | null;
  exerciseName: string;
  equipmentKey: string | null;
  gifUrl: string | null;
  logMode: JournalLogMode;
  notes: string | null;
  sets: JournalSetInput[];
};

type SessionRow = {
  session_id: number;
  workout_id: number | null;
  workout_name: string | null;
  name: string | null;
  notes: string | null;
  performed_at: string;
  created_at: string;
  updated_at: string;
  exercise_count?: number | string;
  set_count?: number | string;
};

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function sessionSource(row: { workout_id?: number | null; workout_name?: string | null }): "workout" | "custom" {
  return row.workout_id != null || String(row.workout_name || "").trim() ? "workout" : "custom";
}

function mapSummary(row: SessionRow): JournalSessionSummary {
  return {
    sessionId: Number(row.session_id),
    workoutId: row.workout_id == null ? null : Number(row.workout_id),
    workoutName: row.workout_name,
    name: row.name,
    notes: row.notes,
    source: sessionSource(row),
    performedAt: row.performed_at,
    exerciseCount: Number(row.exercise_count || 0),
    setCount: Number(row.set_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function parseSessionId(raw: string | undefined) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "Invalid journal session id." });
  }
  return id;
}

export function parseOptionalName(value: unknown): string | null {
  if (value == null) return null;
  const name = String(value).trim();
  if (!name) return null;
  if (name.length > 120) {
    throw createError({ statusCode: 400, statusMessage: "Session name must be 120 characters or fewer." });
  }
  return name;
}

export function parsePerformedAt(value: unknown): Date {
  if (value == null || value === "") return new Date();
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw createError({ statusCode: 400, statusMessage: "performedAt must be a valid date-time." });
    }
    return value;
  }
  const parsed = new Date(String(value).trim());
  if (Number.isNaN(parsed.getTime())) {
    throw createError({ statusCode: 400, statusMessage: "performedAt must be a valid date-time." });
  }
  return parsed;
}

export function parseOptionalWorkoutId(value: unknown): number | null {
  if (value == null || value === "") return null;
  const id = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "workoutId must be a positive integer." });
  }
  return id;
}

function optionalInt(value: unknown, field: string, max = 9999): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) {
    throw createError({ statusCode: 400, statusMessage: `${field} must be a whole number from 0 to ${max}.` });
  }
  return Math.round(n);
}

function optionalWeight(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 9999) {
    throw createError({ statusCode: 400, statusMessage: "weight must be a number from 0 to 9999." });
  }
  return Math.round(n * 100) / 100;
}

function parseWeightUnit(value: unknown): "lb" | "kg" {
  const unitRaw = String(value ?? "lb").trim().toLowerCase();
  if (unitRaw !== "lb" && unitRaw !== "kg") {
    throw createError({ statusCode: 400, statusMessage: "weightUnit must be lb or kg." });
  }
  return unitRaw;
}

function parseLogMode(value: unknown, fallback: JournalLogMode = "reps"): JournalLogMode {
  const raw = String(value ?? fallback).trim().toLowerCase();
  if (raw === "duration" || raw === "reps") return raw;
  throw createError({ statusCode: 400, statusMessage: "logMode must be reps or duration." });
}

function parseSetInput(row: Record<string, unknown>, index: number): JournalSetInput {
  return {
    reps: optionalInt(row.reps, `sets[${index}].reps`),
    weight: optionalWeight(row.weight),
    weightUnit: parseWeightUnit(row.weightUnit ?? row.weight_unit),
    durationSeconds: optionalInt(row.durationSeconds ?? row.duration_seconds, `sets[${index}].durationSeconds`, 86400),
    restSeconds: optionalInt(row.restSeconds ?? row.rest_seconds, `sets[${index}].restSeconds`, 3600),
    notes: parseWorkoutNotes(row.notes),
  };
}

export function parseJournalExerciseInputs(raw: unknown): JournalExerciseInput[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw createError({ statusCode: 400, statusMessage: "exercises must be an array." });
  }
  if (raw.length > 80) {
    throw createError({ statusCode: 400, statusMessage: "A session can have at most 80 exercises." });
  }

  return raw.map((item, index) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const exerciseId = String(row.exerciseId ?? row.exercise_id ?? "").trim() || null;
    let exerciseName = String(row.exerciseName ?? row.exercise_name ?? row.name ?? "").trim();
    if (!exerciseName && exerciseId) exerciseName = exerciseId;
    if (!exerciseName) {
      throw createError({
        statusCode: 400,
        statusMessage: `Exercise ${index + 1} needs a name or catalog id.`,
      });
    }
    if (exerciseName.length > 200) exerciseName = exerciseName.slice(0, 200);

    const setsRaw = row.sets;
    if (setsRaw != null && !Array.isArray(setsRaw)) {
      throw createError({ statusCode: 400, statusMessage: `Exercise ${index + 1} sets must be an array.` });
    }
    if (Array.isArray(setsRaw) && setsRaw.length > 30) {
      throw createError({ statusCode: 400, statusMessage: "An exercise can have at most 30 sets." });
    }
    const sets = Array.isArray(setsRaw)
      ? setsRaw.map((setItem, setIndex) => {
          const setRow = setItem && typeof setItem === "object" ? (setItem as Record<string, unknown>) : {};
          return parseSetInput(setRow, setIndex);
        })
      : [parseSetInput({}, 0)];

    const gifRaw = String(row.gifUrl ?? row.gif_url ?? "").trim();
    const equipmentKey = String(row.equipmentKey ?? row.equipment_key ?? row.equipment ?? "").trim() || null;
    return {
      exerciseId,
      exerciseName,
      equipmentKey,
      gifUrl: gifRaw || null,
      logMode: parseLogMode(row.logMode ?? row.log_mode, equipmentKey === "outdoor" || equipmentKey === "machine" ? "duration" : "reps"),
      notes: parseWorkoutNotes(row.notes),
      sets,
    };
  });
}

export function mapJournalWriteError(error: unknown, fallback: string) {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : "";
  const msg = String((error as { message?: string })?.message ?? "");
  if (code === "42P01") {
    return createError({ statusCode: 500, statusMessage: "Workout journal is not set up yet. Run database migrations." });
  }
  if (code === "23503" && msg.includes("workouts")) {
    return createError({ statusCode: 400, statusMessage: "That workout plan was not found." });
  }
  return createError({ statusCode: 500, statusMessage: fallback });
}

async function catalogSnapshots(
  client: Client,
  exerciseIds: string[],
): Promise<Map<string, { name: string; gifUrl: string | null; equipmentKey: string | null }>> {
  const unique = [...new Set(exerciseIds.filter(Boolean))];
  const map = new Map<string, { name: string; gifUrl: string | null; equipmentKey: string | null }>();
  if (!unique.length) return map;
  await ensureLocalFeaturedEndurance(client);
  const found = await client.query(
    `SELECT exercise_id, name, gif_url, equipment_key
     FROM exercise_catalog
     WHERE exercise_id = ANY($1::text[])`,
    [unique],
  );
  for (const row of found.rows) {
    const id = String(row.exercise_id);
    map.set(id, {
      name: String(row.name || id),
      gifUrl: exerciseGifUrl(id, row.gif_url),
      equipmentKey: row.equipment_key ? String(row.equipment_key) : null,
    });
  }
  return map;
}

function hydrateFromCatalog(item: JournalExerciseInput, catalog: Map<string, { name: string; gifUrl: string | null; equipmentKey: string | null }>): JournalExerciseInput {
  if (!item.exerciseId) return item;
  const snap = catalog.get(item.exerciseId);
  if (!snap) return item;
  const outdoor = snap.equipmentKey === "outdoor" || snap.equipmentKey === "machine";
  return {
    ...item,
    exerciseName: item.exerciseName && item.exerciseName !== item.exerciseId ? item.exerciseName : snap.name,
    gifUrl: item.gifUrl || snap.gifUrl,
    equipmentKey: item.equipmentKey || snap.equipmentKey,
    logMode: item.logMode === "duration" || outdoor ? "duration" : item.logMode,
  };
}

async function insertExercises(client: Client, sessionId: number, exercises: JournalExerciseInput[]) {
  const catalog = await catalogSnapshots(
    client,
    exercises.map((item) => item.exerciseId || "").filter(Boolean),
  );
  for (let i = 0; i < exercises.length; i += 1) {
    const item = hydrateFromCatalog(exercises[i], catalog);
    const inserted = await client.query(
      `INSERT INTO workout_journal_exercises (
          session_id, exercise_id, exercise_name, equipment_key, gif_url, log_mode, sort_order, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING journal_exercise_id`,
      [
        sessionId,
        item.exerciseId,
        item.exerciseName,
        item.equipmentKey,
        item.gifUrl,
        item.logMode,
        i,
        item.notes,
      ],
    );
    const journalExerciseId = Number(inserted.rows[0].journal_exercise_id);
    for (let s = 0; s < item.sets.length; s += 1) {
      const set = item.sets[s];
      await client.query(
        `INSERT INTO workout_journal_sets (
            journal_exercise_id, sort_order, reps, weight, weight_unit, duration_seconds, rest_seconds, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          journalExerciseId,
          s,
          set.reps,
          set.weight,
          set.weightUnit,
          set.durationSeconds,
          set.restSeconds,
          set.notes,
        ],
      );
    }
  }
}

export async function listJournalSessions(
  client: Client,
  userId: number,
  limit = 40,
): Promise<JournalSessionSummary[]> {
  const capped = Math.min(Math.max(Math.round(limit) || 40, 1), 100);
  const result = await client.query(
    `SELECT s.session_id, s.workout_id, s.workout_name, s.name, s.notes, s.performed_at,
            s.created_at, s.updated_at,
            COUNT(DISTINCT e.journal_exercise_id)::int AS exercise_count,
            COUNT(st.journal_set_id)::int AS set_count
     FROM workout_journal_sessions s
     LEFT JOIN workout_journal_exercises e ON e.session_id = s.session_id
     LEFT JOIN workout_journal_sets st ON st.journal_exercise_id = e.journal_exercise_id
     WHERE ${privateUserClause("s")}
     GROUP BY s.session_id
     ORDER BY s.performed_at DESC, s.session_id DESC
     LIMIT $2`,
    [userId, capped],
  );
  return result.rows.map(mapSummary);
}

export async function getJournalSessionById(
  client: Client,
  userId: number,
  sessionId: number,
): Promise<JournalSessionDetail | null> {
  const session = await client.query(
    `SELECT session_id, workout_id, workout_name, name, notes, performed_at, created_at, updated_at
     FROM workout_journal_sessions
     WHERE session_id = $2 AND ${privateUserClauseAt("", 1)}`,
    [userId, sessionId],
  );
  const row = session.rows[0] as SessionRow | undefined;
  if (!row) return null;

  const exercises = await client.query(
    `SELECT journal_exercise_id, exercise_id, exercise_name, equipment_key, gif_url, log_mode, sort_order, notes
     FROM workout_journal_exercises
     WHERE session_id = $1
     ORDER BY sort_order ASC, journal_exercise_id ASC`,
    [sessionId],
  );
  const ids = exercises.rows.map((item) => Number(item.journal_exercise_id));
  const setsByExercise = new Map<number, JournalSetDto[]>();
  if (ids.length) {
    const sets = await client.query(
      `SELECT journal_set_id, journal_exercise_id, sort_order, reps, weight, weight_unit,
              duration_seconds, rest_seconds, notes
       FROM workout_journal_sets
       WHERE journal_exercise_id = ANY($1::int[])
       ORDER BY sort_order ASC, journal_set_id ASC`,
      [ids],
    );
    for (const setRow of sets.rows) {
      const exerciseId = Number(setRow.journal_exercise_id);
      const list = setsByExercise.get(exerciseId) || [];
      list.push({
        journalSetId: Number(setRow.journal_set_id),
        sortOrder: Number(setRow.sort_order),
        reps: asNumber(setRow.reps),
        weight: asNumber(setRow.weight),
        weightUnit: setRow.weight_unit === "kg" ? "kg" : "lb",
        durationSeconds: asNumber(setRow.duration_seconds),
        restSeconds: asNumber(setRow.rest_seconds),
        notes: setRow.notes,
      });
      setsByExercise.set(exerciseId, list);
    }
  }

  return {
    sessionId: Number(row.session_id),
    workoutId: row.workout_id == null ? null : Number(row.workout_id),
    workoutName: row.workout_name,
    name: row.name,
    notes: row.notes,
    source: sessionSource(row),
    performedAt: row.performed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    exercises: exercises.rows.map((item) => {
      const journalExerciseId = Number(item.journal_exercise_id);
      const exerciseId = item.exercise_id ? String(item.exercise_id) : null;
      return {
        journalExerciseId,
        exerciseId,
        exerciseName: String(item.exercise_name || exerciseId || "Exercise"),
        equipmentKey: item.equipment_key ? String(item.equipment_key) : null,
        gifUrl: exerciseGifUrl(exerciseId, item.gif_url),
        logMode: item.log_mode === "duration" ? "duration" : "reps",
        sortOrder: Number(item.sort_order),
        notes: item.notes,
        sets: setsByExercise.get(journalExerciseId) || [],
      };
    }),
  };
}

async function exercisesFromWorkout(
  client: Client,
  userId: number,
  workoutId: number,
): Promise<{ workoutName: string; exercises: JournalExerciseInput[] }> {
  const workout = await getWorkoutById(client, userId, workoutId);
  if (!workout) {
    throw createError({ statusCode: 400, statusMessage: "That workout plan was not found." });
  }
  const catalog = await catalogSnapshots(
    client,
    workout.exercises.map((item) => item.exerciseId),
  );
  const exercises = workout.exercises.map((item) => {
    const snap = catalog.get(item.exerciseId);
    const logMode: JournalLogMode =
      item.durationSeconds != null || snap?.equipmentKey === "outdoor" || snap?.equipmentKey === "machine"
        ? "duration"
        : "reps";
    const setCount = Math.min(Math.max(item.sets ?? 1, 1), 30);
    const setTemplate: JournalSetInput = {
      reps: logMode === "reps" ? item.reps : null,
      weight: item.weight,
      weightUnit: item.weightUnit,
      durationSeconds: logMode === "duration" ? item.durationSeconds : null,
      restSeconds: item.restSeconds,
      notes: null,
    };
    return {
      exerciseId: item.exerciseId,
      exerciseName: item.name || snap?.name || item.exerciseId,
      equipmentKey: snap?.equipmentKey || null,
      gifUrl: item.gifUrl || snap?.gifUrl || null,
      logMode,
      notes: item.notes,
      sets: Array.from({ length: setCount }, () => ({ ...setTemplate })),
    };
  });
  return { workoutName: workout.name, exercises };
}

export async function createJournalSession(
  client: Client,
  userId: number,
  input: {
    performedAt: Date;
    name: string | null;
    notes: string | null;
    workoutId: number | null;
    exercises: JournalExerciseInput[];
  },
): Promise<JournalSessionDetail> {
  let workoutName: string | null = null;
  let exercises = input.exercises;
  if (input.workoutId) {
    const copied = await exercisesFromWorkout(client, userId, input.workoutId);
    workoutName = copied.workoutName;
    exercises = copied.exercises;
  }

  await client.query("BEGIN");
  try {
    const inserted = await client.query(
      `INSERT INTO workout_journal_sessions (user_id, workout_id, workout_name, name, notes, performed_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING session_id`,
      [userId, input.workoutId, workoutName, input.name, input.notes, input.performedAt],
    );
    const sessionId = Number(inserted.rows[0].session_id);
    await insertExercises(client, sessionId, exercises);
    await client.query("COMMIT");
    const detail = await getJournalSessionById(client, userId, sessionId);
    if (!detail) throw createError({ statusCode: 500, statusMessage: "Failed to load the saved session." });
    return detail;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export async function updateJournalSession(
  client: Client,
  userId: number,
  sessionId: number,
  input: {
    performedAt: Date;
    name: string | null;
    notes: string | null;
    exercises: JournalExerciseInput[];
  },
): Promise<JournalSessionDetail> {
  const existing = await getJournalSessionById(client, userId, sessionId);
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "Journal session not found." });
  }
  await client.query("BEGIN");
  try {
    await client.query(
      `UPDATE workout_journal_sessions
       SET name = $3, notes = $4, performed_at = $5, updated_at = NOW()
       WHERE session_id = $2 AND ${privateUserClauseAt("", 1)}`,
      [userId, sessionId, input.name, input.notes, input.performedAt],
    );
    await client.query(`DELETE FROM workout_journal_exercises WHERE session_id = $1`, [sessionId]);
    await insertExercises(client, sessionId, input.exercises);
    await client.query("COMMIT");
    const detail = await getJournalSessionById(client, userId, sessionId);
    if (!detail) throw createError({ statusCode: 500, statusMessage: "Failed to load the saved session." });
    return detail;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export async function deleteJournalSession(client: Client, userId: number, sessionId: number) {
  const result = await client.query(
    `DELETE FROM workout_journal_sessions
     WHERE session_id = $2 AND ${privateUserClauseAt("", 1)}
     RETURNING session_id`,
    [userId, sessionId],
  );
  if (!result.rowCount) {
    throw createError({ statusCode: 404, statusMessage: "Journal session not found." });
  }
}
