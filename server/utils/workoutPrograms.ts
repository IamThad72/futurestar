import { createError } from "h3";
import type { Client } from "pg";
import { privateUserClauseAt } from "./privateUserAccess";
import { isMissingRelation, listWorkouts, type ProgramMembership, type WorkoutSummary } from "./workouts";
import {
  assignLinkSortOrders,
  disambiguateProgramName,
  parseProgramDescription,
  parseProgramName,
} from "~/utils/workoutPrograms.js";

/**
 * Workout programs are private to app_users.user_id.
 * Never filter or write group_id. A program is a named group of links;
 * deleting one removes those links and leaves the workouts in place.
 */

export type ProgramWorkout = WorkoutSummary & {
  sortOrder: number;
};

export type WorkoutProgram = {
  programId: number;
  name: string;
  description: string | null;
  sortOrder: number;
  workoutCount: number;
  createdAt: string;
  updatedAt: string;
  workouts: ProgramWorkout[];
};

export type ProgramList = {
  programs: WorkoutProgram[];
  unassigned: {
    workoutCount: number;
    workouts: WorkoutSummary[];
  };
};

type ProgramRow = {
  program_id: number;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function requireProgramName(value: unknown) {
  const parsed = parseProgramName(value);
  if (!parsed.ok) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }
  return parsed.name;
}

export function parseProgramId(raw: string | undefined) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "Invalid program id." });
  }
  return id;
}

export function parseWorkoutIdList(value: unknown) {
  if (!Array.isArray(value) || !value.length) {
    throw createError({ statusCode: 400, statusMessage: "Choose at least one workout." });
  }
  if (value.length > 200) {
    throw createError({ statusCode: 400, statusMessage: "Choose 200 workouts or fewer." });
  }
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    const id = typeof item === "number" ? item : Number(item);
    if (!Number.isInteger(id) || id <= 0) {
      throw createError({ statusCode: 400, statusMessage: "Invalid workout id." });
    }
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function parseSortOrder(value: unknown, fallback: number) {
  if (value == null || value === "") return fallback;
  const order = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(order) || order < 0 || order > 100000) {
    throw createError({ statusCode: 400, statusMessage: "Sort order must be a whole number from 0 up." });
  }
  return order;
}

async function assertOwnedProgram(client: Client, userId: number, programId: number) {
  const result = await client.query(
    `SELECT program_id
     FROM workout_programs
     WHERE program_id = $2 AND ${privateUserClauseAt("", 1)}`,
    [userId, programId],
  );
  if (!result.rowCount) {
    throw createError({ statusCode: 404, statusMessage: "Program not found." });
  }
}

export async function listPrograms(client: Client, userId: number): Promise<ProgramList> {
  const programs = await client.query(
    `SELECT program_id, name, description, sort_order, created_at, updated_at
     FROM workout_programs
     WHERE ${privateUserClauseAt("", 1)}
     ORDER BY sort_order ASC, program_id ASC`,
    [userId],
  );
  const workouts = await listWorkouts(client, userId);
  const built = (programs.rows as ProgramRow[]).map((row) => {
    const linked = workouts
      .filter((workout) => workout.programs.some((membership) => membership.programId === Number(row.program_id)))
      .map((workout) => ({
        ...workout,
        sortOrder:
          workout.programs.find((membership) => membership.programId === Number(row.program_id))?.sortOrder ?? 0,
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder || left.workoutId - right.workoutId);
    return {
      programId: Number(row.program_id),
      name: row.name,
      description: row.description,
      sortOrder: Number(row.sort_order),
      workoutCount: linked.length,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      workouts: linked,
    };
  });
  const unassigned = workouts.filter((workout) => workout.programs.length === 0);
  return {
    programs: built,
    unassigned: { workoutCount: unassigned.length, workouts: unassigned },
  };
}

export async function getProgram(client: Client, userId: number, programId: number): Promise<WorkoutProgram> {
  const list = await listPrograms(client, userId);
  const program = list.programs.find((item) => item.programId === programId);
  if (!program) {
    throw createError({ statusCode: 404, statusMessage: "Program not found." });
  }
  return program;
}

async function nextProgramSort(client: Client, userId: number) {
  const result = await client.query(
    `SELECT COALESCE(MAX(sort_order), -1)::int AS max_sort
     FROM workout_programs
     WHERE ${privateUserClauseAt("", 1)}`,
    [userId],
  );
  return Number(result.rows[0]?.max_sort ?? -1) + 1;
}

export async function createProgram(
  client: Client,
  userId: number,
  input: { name: unknown; description?: unknown; sortOrder?: unknown },
) {
  const name = requireProgramName(input.name);
  const description = parseProgramDescription(input.description);
  const sortOrder =
    input.sortOrder == null || input.sortOrder === ""
      ? await nextProgramSort(client, userId)
      : parseSortOrder(input.sortOrder, 0);
  const inserted = await client.query(
    `INSERT INTO workout_programs (user_id, name, description, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING program_id, name, description, sort_order, created_at, updated_at`,
    [userId, name, description, sortOrder],
  );
  const row = inserted.rows[0] as ProgramRow;
  return {
    programId: Number(row.program_id),
    name: row.name,
    description: row.description,
    sortOrder: Number(row.sort_order),
    workoutCount: 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workouts: [] as ProgramWorkout[],
  };
}

export async function createProgramForPlan(client: Client, userId: number, title: string, description: string | null) {
  const existing = await client.query(
    `SELECT name FROM workout_programs WHERE ${privateUserClauseAt("", 1)}`,
    [userId],
  );
  const name = disambiguateProgramName(
    title,
    existing.rows.map((row) => String(row.name ?? "")),
  );
  return createProgram(client, userId, { name, description });
}

export async function updateProgram(
  client: Client,
  userId: number,
  programId: number,
  input: { name: unknown; description?: unknown; sortOrder?: unknown },
) {
  const current = await getProgram(client, userId, programId);
  const name = requireProgramName(input.name);
  const description = input.description === undefined ? current.description : parseProgramDescription(input.description);
  const sortOrder = parseSortOrder(input.sortOrder, current.sortOrder);
  const updated = await client.query(
    `UPDATE workout_programs
     SET name = $3, description = $4, sort_order = $5, updated_at = NOW()
     WHERE program_id = $2 AND ${privateUserClauseAt("", 1)}
     RETURNING program_id`,
    [userId, programId, name, description, sortOrder],
  );
  if (!updated.rowCount) {
    throw createError({ statusCode: 404, statusMessage: "Program not found." });
  }
  return getProgram(client, userId, programId);
}

export async function deleteProgram(client: Client, userId: number, programId: number) {
  const result = await client.query(
    `DELETE FROM workout_programs
     WHERE program_id = $2 AND ${privateUserClauseAt("", 1)}
     RETURNING program_id`,
    [userId, programId],
  );
  if (!result.rowCount) {
    throw createError({ statusCode: 404, statusMessage: "Program not found." });
  }
}

async function ownedWorkouts(client: Client, userId: number, workoutIds: number[]) {
  const result = await client.query(
    `SELECT workout_id, name
     FROM workouts
     WHERE ${privateUserClauseAt("", 1)} AND workout_id = ANY($2::int[])`,
    [userId, workoutIds],
  );
  return result.rows as Array<{ workout_id: number; name: string }>;
}

async function existingLinks(client: Client, userId: number, programId: number) {
  const result = await client.query(
    `SELECT workout_id, sort_order
     FROM workout_program_items
     WHERE ${privateUserClauseAt("", 1)} AND program_id = $2`,
    [userId, programId],
  );
  return result.rows as Array<{ workout_id: number; sort_order: number }>;
}

/**
 * Insert links for this user. Ids already in the program are left as they are.
 * Does not read or write workout_exercises, and does not change other programs.
 */
export async function addProgramItems(client: Client, userId: number, programId: number, workoutIds: number[]) {
  await assertOwnedProgram(client, userId, programId);
  const rows = await ownedWorkouts(client, userId, workoutIds);
  if (rows.length !== workoutIds.length) {
    throw createError({ statusCode: 404, statusMessage: "Workout not found." });
  }
  const names = new Map(rows.map((row) => [Number(row.workout_id), row.name]));
  const links = await existingLinks(client, userId, programId);
  const linked = new Set(links.map((row) => Number(row.workout_id)));
  const pending = workoutIds
    .filter((id) => !linked.has(id))
    .map((id) => ({ workoutId: id, name: names.get(id) || "" }));
  const assigned = assignLinkSortOrders(
    pending,
    links.map((row) => Number(row.sort_order)),
  );
  for (const item of assigned) {
    await client.query(
      `INSERT INTO workout_program_items (user_id, program_id, workout_id, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (program_id, workout_id) DO NOTHING`,
      [userId, programId, item.workoutId, item.sortOrder],
    );
  }
  return getProgram(client, userId, programId);
}

export async function removeProgramItem(client: Client, userId: number, programId: number, workoutId: number) {
  await assertOwnedProgram(client, userId, programId);
  const result = await client.query(
    `DELETE FROM workout_program_items
     WHERE ${privateUserClauseAt("", 1)} AND program_id = $2 AND workout_id = $3
     RETURNING program_item_id`,
    [userId, programId, workoutId],
  );
  if (!result.rowCount) {
    throw createError({ statusCode: 404, statusMessage: "That workout is not in this program." });
  }
}

export async function reorderProgramItems(client: Client, userId: number, programId: number, workoutIds: number[]) {
  await assertOwnedProgram(client, userId, programId);
  const links = await existingLinks(client, userId, programId);
  const have = links.map((row) => Number(row.workout_id));
  const wanted = new Set(workoutIds);
  if (workoutIds.length !== have.length || wanted.size !== workoutIds.length || have.some((id) => !wanted.has(id))) {
    throw createError({
      statusCode: 400,
      statusMessage: "Reorder the workouts that are already in this program.",
    });
  }
  for (let index = 0; index < workoutIds.length; index += 1) {
    await client.query(
      `UPDATE workout_program_items
       SET sort_order = $4
       WHERE ${privateUserClauseAt("", 1)} AND program_id = $2 AND workout_id = $3`,
      [userId, programId, workoutIds[index], index],
    );
  }
  return getProgram(client, userId, programId);
}

export function programSetupError(error: unknown) {
  if (isMissingRelation(error)) {
    return createError({ statusCode: 500, statusMessage: "Programs are not set up yet. Run database migrations." });
  }
  return null;
}
