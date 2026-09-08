import { createError } from "h3";
import type { Client } from "pg";
import { ensureLocalFeaturedEndurance } from "./exerciseCatalog";
import { privateUserClause, privateUserClauseAt } from "./privateUserAccess";
import { exerciseGifUrl } from "./exerciseDb";

/**
 * Physical workouts are always scoped to `app_users.user_id`.
 * Never filter or write `group_id`. Linked accounts do not share workouts.
 */

export type WorkoutSummary = {
  workoutId: number;
  name: string;
  notes: string | null;
  exerciseCount: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkoutExerciseDto = {
  workoutExerciseId: number;
  exerciseId: string;
  name: string;
  gifUrl: string | null;
  equipmentKey: string | null;
  sortOrder: number;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  weightUnit: "lb" | "kg";
  restSeconds: number | null;
  durationSeconds: number | null;
  notes: string | null;
};

export type WorkoutDetail = {
  workoutId: number;
  name: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  exercises: WorkoutExerciseDto[];
};

export type WorkoutExerciseInput = {
  exerciseId: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  weightUnit: "lb" | "kg";
  restSeconds: number | null;
  durationSeconds: number | null;
  notes: string | null;
};

type WorkoutRow = {
  workout_id: number;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  exercise_count?: number | string;
};

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapSummary(row: WorkoutRow): WorkoutSummary {
  return {
    workoutId: Number(row.workout_id),
    name: row.name,
    notes: row.notes,
    exerciseCount: Number(row.exercise_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExercise(row: {
  workout_exercise_id: number;
  exercise_id: string;
  name: string | null;
  gif_url: string | null;
  equipment_key: string | null;
  sort_order: number;
  sets: number | null;
  reps: number | null;
  weight: string | number | null;
  weight_unit: "lb" | "kg";
  rest_seconds: number | null;
  duration_seconds: number | null;
  notes: string | null;
}): WorkoutExerciseDto {
  return {
    workoutExerciseId: Number(row.workout_exercise_id),
    exerciseId: row.exercise_id,
    name: row.name || row.exercise_id,
    gifUrl: exerciseGifUrl(row.exercise_id, row.gif_url),
    equipmentKey: row.equipment_key ? String(row.equipment_key) : null,
    sortOrder: Number(row.sort_order),
    sets: asNumber(row.sets),
    reps: asNumber(row.reps),
    weight: asNumber(row.weight),
    weightUnit: row.weight_unit === "kg" ? "kg" : "lb",
    restSeconds: asNumber(row.rest_seconds),
    durationSeconds: asNumber(row.duration_seconds),
    notes: row.notes,
  };
}

export function parseWorkoutName(value: unknown): string {
  const name = String(value ?? "").trim();
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: "Workout name is required." });
  }
  if (name.length > 120) {
    throw createError({ statusCode: 400, statusMessage: "Workout name must be 120 characters or fewer." });
  }
  return name;
}

export function parseWorkoutNotes(value: unknown): string | null {
  if (value == null) return null;
  const notes = String(value).trim();
  return notes ? notes.slice(0, 2000) : null;
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

export function parseExerciseInputs(raw: unknown): WorkoutExerciseInput[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw createError({ statusCode: 400, statusMessage: "exercises must be an array." });
  }
  if (raw.length > 80) {
    throw createError({ statusCode: 400, statusMessage: "A workout can have at most 80 exercises." });
  }

  return raw.map((item, index) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const exerciseId = String(row.exerciseId ?? row.exercise_id ?? "").trim();
    if (!exerciseId) {
      throw createError({
        statusCode: 400,
        statusMessage: `Exercise ${index + 1} is missing exerciseId.`,
      });
    }
    const unitRaw = String(row.weightUnit ?? row.weight_unit ?? "lb").trim().toLowerCase();
    if (unitRaw !== "lb" && unitRaw !== "kg") {
      throw createError({ statusCode: 400, statusMessage: "weightUnit must be lb or kg." });
    }
    return {
      exerciseId,
      sets: optionalInt(row.sets, "sets"),
      reps: optionalInt(row.reps, "reps"),
      weight: optionalWeight(row.weight),
      weightUnit: unitRaw,
      restSeconds: optionalInt(row.restSeconds ?? row.rest_seconds, "restSeconds", 3600),
      durationSeconds: optionalInt(row.durationSeconds ?? row.duration_seconds, "durationSeconds", 86400),
      notes: parseWorkoutNotes(row.notes),
    };
  });
}

export function isMissingRelation(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : "";
  return code === "42P01";
}

export function mapWorkoutWriteError(error: unknown, fallback: string) {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : "";
  const msg = String((error as { message?: string })?.message ?? "");
  if (code === "23505" || msg.includes("idx_workouts_user_name")) {
    return createError({ statusCode: 400, statusMessage: "You already have a workout with that name." });
  }
  if (code === "23503" && msg.includes("exercise_catalog")) {
    return createError({
      statusCode: 400,
      statusMessage: "That exercise is not in the catalog. Choose another exercise.",
    });
  }
  if (code === "42P01") {
    return createError({ statusCode: 500, statusMessage: "Workouts are not set up yet. Run database migrations." });
  }
  return createError({ statusCode: 500, statusMessage: fallback });
}

export async function listWorkouts(client: Client, userId: number): Promise<WorkoutSummary[]> {
  const result = await client.query(
    `SELECT w.workout_id, w.name, w.notes, w.created_at, w.updated_at,
            COUNT(we.workout_exercise_id)::int AS exercise_count
     FROM workouts w
     LEFT JOIN workout_exercises we ON we.workout_id = w.workout_id
     WHERE ${privateUserClause("w")}
     GROUP BY w.workout_id
     ORDER BY w.updated_at DESC, w.workout_id DESC`,
    [userId],
  );
  return result.rows.map(mapSummary);
}

export async function getWorkoutById(
  client: Client,
  userId: number,
  workoutId: number,
): Promise<WorkoutDetail | null> {
  const workout = await client.query(
    `SELECT workout_id, name, notes, created_at, updated_at
     FROM workouts
     WHERE workout_id = $2 AND ${privateUserClauseAt("", 1)}`,
    [userId, workoutId],
  );
  const row = workout.rows[0] as WorkoutRow | undefined;
  if (!row) return null;

  const exercises = await client.query(
    `SELECT we.workout_exercise_id, we.exercise_id, we.sort_order, we.sets, we.reps,
            we.weight, we.weight_unit, we.rest_seconds, we.duration_seconds, we.notes,
            c.name, c.gif_url, c.equipment_key
     FROM workout_exercises we
     LEFT JOIN exercise_catalog c ON c.exercise_id = we.exercise_id
     WHERE we.workout_id = $1
     ORDER BY we.sort_order ASC, we.workout_exercise_id ASC`,
    [workoutId],
  );

  return {
    workoutId: Number(row.workout_id),
    name: row.name,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    exercises: exercises.rows.map(mapExercise),
  };
}

async function assertCatalogIds(client: Client, exerciseIds: string[]) {
  await ensureLocalFeaturedEndurance(client);
  const unique = [...new Set(exerciseIds)];
  if (!unique.length) return;
  const found = await client.query(
    `SELECT exercise_id FROM exercise_catalog WHERE exercise_id = ANY($1::text[])`,
    [unique],
  );
  const have = new Set(found.rows.map((row) => String(row.exercise_id)));
  const missing = unique.filter((id) => !have.has(id));
  if (missing.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "One or more exercises are not in the catalog.",
    });
  }
}

async function insertExercises(client: Client, workoutId: number, exercises: WorkoutExerciseInput[]) {
  for (let i = 0; i < exercises.length; i += 1) {
    const item = exercises[i];
    await client.query(
      `INSERT INTO workout_exercises (
          workout_id, exercise_id, sort_order, sets, reps, weight, weight_unit,
          rest_seconds, duration_seconds, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        workoutId,
        item.exerciseId,
        i,
        item.sets,
        item.reps,
        item.weight,
        item.weightUnit,
        item.restSeconds,
        item.durationSeconds,
        item.notes,
      ],
    );
  }
}

export async function createWorkout(
  client: Client,
  userId: number,
  input: { name: string; notes: string | null; exercises: WorkoutExerciseInput[] },
): Promise<WorkoutDetail> {
  await assertCatalogIds(client, input.exercises.map((item) => item.exerciseId));
  await client.query("BEGIN");
  try {
    const inserted = await client.query(
      `INSERT INTO workouts (user_id, name, notes)
       VALUES ($1, $2, $3)
       RETURNING workout_id, name, notes, created_at, updated_at`,
      [userId, input.name, input.notes],
    );
    const workoutId = Number(inserted.rows[0].workout_id);
    await insertExercises(client, workoutId, input.exercises);
    await client.query("COMMIT");
    const detail = await getWorkoutById(client, userId, workoutId);
    if (!detail) throw createError({ statusCode: 500, statusMessage: "Failed to load the saved workout." });
    return detail;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export async function updateWorkout(
  client: Client,
  userId: number,
  workoutId: number,
  input: { name: string; notes: string | null; exercises: WorkoutExerciseInput[] },
): Promise<WorkoutDetail> {
  const existing = await getWorkoutById(client, userId, workoutId);
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "Workout not found." });
  }
  await assertCatalogIds(client, input.exercises.map((item) => item.exerciseId));
  await client.query("BEGIN");
  try {
    await client.query(
      `UPDATE workouts
       SET name = $3, notes = $4, updated_at = NOW()
       WHERE workout_id = $2 AND ${privateUserClauseAt("", 1)}`,
      [userId, workoutId, input.name, input.notes],
    );
    await client.query(`DELETE FROM workout_exercises WHERE workout_id = $1`, [workoutId]);
    await insertExercises(client, workoutId, input.exercises);
    await client.query("COMMIT");
    const detail = await getWorkoutById(client, userId, workoutId);
    if (!detail) throw createError({ statusCode: 500, statusMessage: "Failed to load the saved workout." });
    return detail;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export async function deleteWorkout(client: Client, userId: number, workoutId: number) {
  const result = await client.query(
    `DELETE FROM workouts
     WHERE workout_id = $2 AND ${privateUserClauseAt("", 1)}
     RETURNING workout_id`,
    [userId, workoutId],
  );
  if (!result.rowCount) {
    throw createError({ statusCode: 404, statusMessage: "Workout not found." });
  }
}

export function parseWorkoutId(raw: string | undefined) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "Invalid workout id." });
  }
  return id;
}
