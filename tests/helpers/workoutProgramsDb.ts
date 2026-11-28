/**
 * In-memory pg stand-in for program and workout handlers.
 * Queries that forget user_id return other people's rows, so the privacy tests fail.
 */

type Row = Record<string, unknown>;

type QueryResult = { rows: Row[]; rowCount: number };

function result(rows: Row[], rowCount = rows.length): QueryResult {
  return { rows, rowCount };
}

function uniqueError(constraint: string) {
  const error = new Error(`duplicate key value violates unique constraint "${constraint}"`) as Error & { code: string };
  error.code = "23505";
  return error;
}

function same(left: unknown, right: unknown) {
  return left === right || (left != null && right != null && String(left) === String(right));
}

export type ProgramTestUser = {
  user_id: number;
  email: string;
  display_name: string | null;
  profile_photo: string | null;
  session_token: string;
};

export const PROGRAM_USERS: Record<"a" | "b", ProgramTestUser> = {
  a: {
    user_id: 1,
    email: "a@example.com",
    display_name: "User A",
    profile_photo: null,
    session_token: "session-user-a",
  },
  b: {
    user_id: 2,
    email: "b@example.com",
    display_name: "User B",
    profile_photo: null,
    session_token: "session-user-b",
  },
};

export class WorkoutProgramsDb {
  users: ProgramTestUser[] = [];
  workouts: Row[] = [];
  exercises: Row[] = [];
  programs: Row[] = [];
  items: Row[] = [];
  catalog = new Set<string>();
  exerciseWrites: string[] = [];
  private nextWorkoutId = 1;
  private nextExerciseId = 1;
  private nextProgramId = 1;
  private nextItemId = 1;
  private snapshots: string[] = [];

  seedUsers() {
    this.users = [PROGRAM_USERS.a, PROGRAM_USERS.b];
  }

  client() {
    return {
      connect: async () => undefined,
      query: async (sql: string, params: unknown[] = []) => this.query(sql, params),
      end: async () => undefined,
    };
  }

  query(sql: string, params: unknown[] = []): QueryResult {
    const text = sql.replace(/\s+/g, " ").trim();
    if (text === "BEGIN") {
      this.snapshots.push(this.capture());
      return result([]);
    }
    if (text === "COMMIT") {
      this.snapshots.pop();
      return result([]);
    }
    if (text === "ROLLBACK") {
      const saved = this.snapshots.pop();
      if (saved) this.restore(saved);
      return result([]);
    }
    if (text.startsWith("INSERT INTO exercise_catalog")) {
      if (params[0] != null) this.catalog.add(String(params[0]));
      return result([]);
    }
    if (text.includes("FROM exercise_catalog") && text.includes("exercise_id = ANY")) {
      const ids = Array.isArray(params[0]) ? params[0].map(String) : [];
      return result(ids.filter((id) => this.catalog.has(id)).map((exercise_id) => ({ exercise_id })));
    }
    if (text.includes("FROM app_sessions")) return this.sessionUser(params);
    if (text.startsWith("INSERT INTO workout_exercises")) return this.insertExercise(text, params);
    if (text.startsWith("INSERT INTO workout_program_items")) return this.insertItem(params);
    if (text.startsWith("INSERT INTO workout_programs")) return this.insertProgram(params);
    if (text.startsWith("INSERT INTO workouts")) return this.insertWorkout(params);
    if (text.startsWith("DELETE FROM workout_program_items")) return this.deleteItems(text, params);
    if (text.startsWith("DELETE FROM workout_programs")) return this.deleteProgram(params);
    if (text.startsWith("UPDATE workout_program_items")) return this.updateItemOrder(params);
    if (text.startsWith("UPDATE workout_programs")) return this.updateProgram(params);
    if (text.includes("COUNT(we.workout_exercise_id)")) return this.listWorkouts(params);
    if (text.includes("FROM workout_exercises we")) return this.listExercises(params);
    if (text.includes("FROM workout_program_items") && text.includes("program_name")) return this.memberships(text, params);
    if (text.startsWith("SELECT sort_order FROM workout_program_items")) return this.itemSorts(params);
    if (text.startsWith("SELECT workout_id, sort_order FROM workout_program_items")) return this.itemLinks(params);
    if (text.startsWith("SELECT workout_id, name FROM workouts")) return this.workoutsByIds(params);
    if (text.startsWith("SELECT workout_id, name, notes")) return this.workoutById(params);
    if (text.startsWith("SELECT COALESCE(MAX(sort_order)")) return this.maxProgramSort(params);
    if (text.startsWith("SELECT name FROM workout_programs")) return this.programNames(params);
    if (text.startsWith("SELECT program_id FROM workout_programs")) return this.programOwned(params);
    if (text.startsWith("SELECT program_id, name, description")) return this.listProgramRows(params);
    throw new Error(`Unhandled SQL in workout program test db: ${text}`);
  }

  private capture() {
    return JSON.stringify({
      workouts: this.workouts,
      exercises: this.exercises,
      programs: this.programs,
      items: this.items,
      nextWorkoutId: this.nextWorkoutId,
      nextExerciseId: this.nextExerciseId,
      nextProgramId: this.nextProgramId,
      nextItemId: this.nextItemId,
    });
  }

  private restore(saved: string) {
    const parsed = JSON.parse(saved) as {
      workouts: Row[];
      exercises: Row[];
      programs: Row[];
      items: Row[];
      nextWorkoutId: number;
      nextExerciseId: number;
      nextProgramId: number;
      nextItemId: number;
    };
    this.workouts = parsed.workouts;
    this.exercises = parsed.exercises;
    this.programs = parsed.programs;
    this.items = parsed.items;
    this.nextWorkoutId = parsed.nextWorkoutId;
    this.nextExerciseId = parsed.nextExerciseId;
    this.nextProgramId = parsed.nextProgramId;
    this.nextItemId = parsed.nextItemId;
  }

  private sessionUser(params: unknown[]) {
    const token = String(params[0] ?? "");
    const user = this.users.find((item) => item.session_token === token);
    if (!user) return result([]);
    return result([
      {
        user_id: user.user_id,
        email: user.email,
        display_name: user.display_name,
        profile_photo: user.profile_photo,
      },
    ]);
  }

  private insertWorkout(params: unknown[]) {
    const userId = Number(params[0]);
    const name = String(params[1] ?? "");
    const clash = this.workouts.some(
      (row) => Number(row.user_id) === userId && String(row.name).trim().toLowerCase() === name.trim().toLowerCase(),
    );
    if (clash) throw uniqueError("idx_workouts_user_name");
    const now = new Date().toISOString();
    const row = {
      workout_id: this.nextWorkoutId,
      user_id: userId,
      name,
      notes: params[2] ?? null,
      created_at: now,
      updated_at: now,
    };
    this.nextWorkoutId += 1;
    this.workouts.push(row);
    return result([row], 1);
  }

  private insertExercise(text: string, params: unknown[]) {
    this.exerciseWrites.push(text);
    const row = {
      workout_exercise_id: this.nextExerciseId,
      workout_id: Number(params[0]),
      exercise_id: String(params[1]),
      sort_order: Number(params[2]),
      sets: params[3],
      reps: params[4],
      weight: params[5],
      weight_unit: params[6] || "lb",
      rest_seconds: params[7],
      duration_seconds: params[8],
      notes: params[9] ?? null,
    };
    this.nextExerciseId += 1;
    this.exercises.push(row);
    return result([row], 1);
  }

  private insertProgram(params: unknown[]) {
    const userId = Number(params[0]);
    const name = String(params[1] ?? "");
    const clash = this.programs.some(
      (row) => Number(row.user_id) === userId && String(row.name).trim().toLowerCase() === name.trim().toLowerCase(),
    );
    if (clash) throw uniqueError("idx_workout_programs_user_name");
    const now = new Date().toISOString();
    const row = {
      program_id: this.nextProgramId,
      user_id: userId,
      name,
      description: params[2] ?? null,
      sort_order: Number(params[3] ?? 0),
      created_at: now,
      updated_at: now,
    };
    this.nextProgramId += 1;
    this.programs.push(row);
    return result([row], 1);
  }

  private insertItem(params: unknown[]) {
    const userId = Number(params[0]);
    const programId = Number(params[1]);
    const workoutId = Number(params[2]);
    const existing = this.items.find((row) => Number(row.program_id) === programId && Number(row.workout_id) === workoutId);
    if (existing) return result([], 0);
    const row = {
      program_item_id: this.nextItemId,
      user_id: userId,
      program_id: programId,
      workout_id: workoutId,
      sort_order: Number(params[3] ?? 0),
      created_at: new Date().toISOString(),
    };
    this.nextItemId += 1;
    this.items.push(row);
    return result([row], 1);
  }

  private deleteItems(text: string, params: unknown[]) {
    if (text.includes("workout_id = $3")) {
      const userId = Number(params[0]);
      const programId = Number(params[1]);
      const workoutId = Number(params[2]);
      const doomed = this.items.filter(
        (row) =>
          Number(row.user_id) === userId && Number(row.program_id) === programId && Number(row.workout_id) === workoutId,
      );
      this.items = this.items.filter((row) => !doomed.includes(row));
      return result(doomed.map((row) => ({ program_item_id: row.program_item_id })), doomed.length);
    }
    return result([], 0);
  }

  private deleteProgram(params: unknown[]) {
    const userId = Number(params[0]);
    const programId = Number(params[1]);
    const doomed = this.programs.filter((row) => Number(row.user_id) === userId && Number(row.program_id) === programId);
    this.programs = this.programs.filter((row) => !doomed.includes(row));
    this.items = this.items.filter((row) => Number(row.program_id) !== programId);
    return result(doomed.map((row) => ({ program_id: row.program_id })), doomed.length);
  }

  private updateItemOrder(params: unknown[]) {
    const userId = Number(params[0]);
    const programId = Number(params[1]);
    const workoutId = Number(params[2]);
    const sortOrder = Number(params[3]);
    let count = 0;
    for (const row of this.items) {
      if (Number(row.user_id) === userId && Number(row.program_id) === programId && Number(row.workout_id) === workoutId) {
        row.sort_order = sortOrder;
        count += 1;
      }
    }
    return result([], count);
  }

  private updateProgram(params: unknown[]) {
    const userId = Number(params[0]);
    const programId = Number(params[1]);
    const row = this.programs.find((item) => Number(item.user_id) === userId && Number(item.program_id) === programId);
    if (!row) return result([], 0);
    const name = String(params[2] ?? "");
    const clash = this.programs.some(
      (item) =>
        item !== row &&
        Number(item.user_id) === userId &&
        String(item.name).trim().toLowerCase() === name.trim().toLowerCase(),
    );
    if (clash) throw uniqueError("idx_workout_programs_user_name");
    row.name = name;
    row.description = params[3] ?? null;
    row.sort_order = Number(params[4] ?? 0);
    row.updated_at = new Date().toISOString();
    return result([{ program_id: row.program_id }], 1);
  }

  private listWorkouts(params: unknown[]) {
    const userId = Number(params[0]);
    const rows = this.workouts
      .filter((row) => Number(row.user_id) === userId)
      .sort((left, right) => {
        const byTime = String(right.updated_at).localeCompare(String(left.updated_at));
        return byTime || Number(right.workout_id) - Number(left.workout_id);
      })
      .map((row) => ({
        ...row,
        exercise_count: this.exercises.filter((item) => same(item.workout_id, row.workout_id)).length,
      }));
    return result(rows);
  }

  private listExercises(params: unknown[]) {
    const workoutId = Number(params[0]);
    const rows = this.exercises
      .filter((row) => Number(row.workout_id) === workoutId)
      .sort((left, right) => Number(left.sort_order) - Number(right.sort_order) || Number(left.workout_exercise_id) - Number(right.workout_exercise_id))
      .map((row) => ({
        ...row,
        name: String(row.exercise_id),
        gif_url: null,
        equipment_key: null,
      }));
    return result(rows);
  }

  private memberships(text: string, params: unknown[]) {
    const userId = Number(params[0]);
    const workoutId = text.includes("i.workout_id = $2") ? Number(params[1]) : null;
    const rows = this.items
      .filter((item) => Number(item.user_id) === userId && (workoutId == null || Number(item.workout_id) === workoutId))
      .map((item) => {
        const program = this.programs.find(
          (row) => Number(row.program_id) === Number(item.program_id) && Number(row.user_id) === Number(item.user_id),
        );
        if (!program) return null;
        return {
          workout_id: item.workout_id,
          program_id: item.program_id,
          sort_order: item.sort_order,
          program_name: program.name,
          program_sort: program.sort_order,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
      .sort((left, right) => {
        const byProgram = Number(left.program_sort) - Number(right.program_sort) || Number(left.program_id) - Number(right.program_id);
        return byProgram || Number(left.sort_order) - Number(right.sort_order) || Number(left.workout_id) - Number(right.workout_id);
      });
    return result(rows);
  }

  private itemSorts(params: unknown[]) {
    return result(this.linked(params).map((row) => ({ sort_order: row.sort_order })));
  }

  private itemLinks(params: unknown[]) {
    return result(this.linked(params).map((row) => ({ workout_id: row.workout_id, sort_order: row.sort_order })));
  }

  private linked(params: unknown[]) {
    const userId = Number(params[0]);
    const programId = Number(params[1]);
    return this.items.filter((row) => Number(row.user_id) === userId && Number(row.program_id) === programId);
  }

  private workoutsByIds(params: unknown[]) {
    const userId = Number(params[0]);
    const ids = new Set((Array.isArray(params[1]) ? params[1] : []).map(Number));
    return result(
      this.workouts
        .filter((row) => Number(row.user_id) === userId && ids.has(Number(row.workout_id)))
        .map((row) => ({ workout_id: row.workout_id, name: row.name })),
    );
  }

  private workoutById(params: unknown[]) {
    const userId = Number(params[0]);
    const workoutId = Number(params[1]);
    return result(this.workouts.filter((row) => Number(row.user_id) === userId && Number(row.workout_id) === workoutId));
  }

  private maxProgramSort(params: unknown[]) {
    const userId = Number(params[0]);
    const orders = this.programs.filter((row) => Number(row.user_id) === userId).map((row) => Number(row.sort_order));
    return result([{ max_sort: orders.length ? Math.max(...orders) : -1 }]);
  }

  private programNames(params: unknown[]) {
    const userId = Number(params[0]);
    return result(this.programs.filter((row) => Number(row.user_id) === userId).map((row) => ({ name: row.name })));
  }

  private programOwned(params: unknown[]) {
    const userId = Number(params[0]);
    const programId = Number(params[1]);
    return result(
      this.programs
        .filter((row) => Number(row.user_id) === userId && Number(row.program_id) === programId)
        .map((row) => ({ program_id: row.program_id })),
    );
  }

  private listProgramRows(params: unknown[]) {
    const userId = Number(params[0]);
    const rows = this.programs
      .filter((row) => Number(row.user_id) === userId)
      .sort((left, right) => Number(left.sort_order) - Number(right.sort_order) || Number(left.program_id) - Number(right.program_id));
    return result(rows);
  }
}

export function installWorkoutProgramsTestDb(db: WorkoutProgramsDb) {
  (globalThis as { __workoutProgramsTestDb?: WorkoutProgramsDb }).__workoutProgramsTestDb = db;
}
