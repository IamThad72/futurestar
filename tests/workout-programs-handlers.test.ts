import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeEvent } from "./helpers/event";
import { installWorkoutProgramsTestDb, PROGRAM_USERS, WorkoutProgramsDb } from "./helpers/workoutProgramsDb";
import programsDelete from "../server/api/physical/programs/[id].delete";
import programsGetOne from "../server/api/physical/programs/[id].get";
import programsPut from "../server/api/physical/programs/[id].put";
import programItemsDelete from "../server/api/physical/programs/[id]/items/[workoutId].delete";
import programItemsPut from "../server/api/physical/programs/[id]/items.put";
import programReorder from "../server/api/physical/programs/[id]/reorder.put";
import programsGet from "../server/api/physical/programs/index.get";
import programsPost from "../server/api/physical/programs/index.post";
import workoutsPost from "../server/api/physical/workouts/index.post";
import planSave from "../server/api/physical/workouts/plan-save.post";

vi.mock("../server/utils/db", () => ({
  createDbClient: () => {
    const db = (globalThis as { __workoutProgramsTestDb?: { client: () => unknown } }).__workoutProgramsTestDb;
    if (!db) throw new Error("Workout program test database is not initialized.");
    return db.client();
  },
}));

type Handler = (event: ReturnType<typeof makeEvent>) => Promise<unknown>;

function call(handler: Handler, options: {
  method?: string;
  url: string;
  user?: keyof typeof PROGRAM_USERS;
  body?: unknown;
  params?: Record<string, string>;
}) {
  const headers: Record<string, string> = {};
  if (options.user) headers.cookie = `session=${PROGRAM_USERS[options.user].session_token}`;
  return handler(makeEvent({
    method: options.method,
    url: options.url,
    headers,
    body: options.body,
    params: options.params,
  }));
}

async function expectStatus(promise: Promise<unknown>, statusCode: number, statusMessage?: string) {
  try {
    const value = await promise;
    throw new Error(`expected HTTP ${statusCode} but the handler resolved: ${JSON.stringify(value)}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("expected HTTP")) throw error;
    expect(error).toMatchObject({ statusCode });
    if (statusMessage) expect((error as { statusMessage?: string }).statusMessage).toBe(statusMessage);
  }
}

let db: WorkoutProgramsDb;

beforeEach(() => {
  db = new WorkoutProgramsDb();
  db.seedUsers();
  db.catalog.add("ex-squat");
  installWorkoutProgramsTestDb(db);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

async function createProgram(user: keyof typeof PROGRAM_USERS, name: string) {
  const response = (await call(programsPost, {
    method: "POST",
    url: "/api/physical/programs",
    user,
    body: { name, description: `${name} notes` },
  })) as { program: { programId: number; name: string } };
  return response.program;
}

async function createWorkout(user: keyof typeof PROGRAM_USERS, name: string, programId?: number) {
  const response = (await call(workoutsPost, {
    method: "POST",
    url: "/api/physical/workouts",
    user,
    body: {
      name,
      notes: "",
      exercises: [],
      programId,
    },
  })) as { workout: { workoutId: number; name: string; programs: Array<{ programId: number }> } };
  return response.workout;
}

describe("workout programs", () => {
  it("requires a signed-in user", async () => {
    await expectStatus(call(programsGet, { url: "/api/physical/programs" }), 401);
  });

  it("creates, lists, renames, and rejects a duplicate program name", async () => {
    const created = await createProgram("a", "Strength");
    expect(created.name).toBe("Strength");
    const renamed = (await call(programsPut, {
      method: "PUT",
      url: `/api/physical/programs/${created.programId}`,
      user: "a",
      params: { id: String(created.programId) },
      body: { name: "Strength block", description: "Keep the easy days.", sortOrder: 3 },
    })) as { program: { name: string; description: string; sortOrder: number } };
    expect(renamed.program.name).toBe("Strength block");
    expect(renamed.program.description).toBe("Keep the easy days.");
    expect(renamed.program.sortOrder).toBe(3);
    await expectStatus(
      call(programsPost, { method: "POST", url: "/api/physical/programs", user: "a", body: { name: "strength block" } }),
      400,
      "You already have a program with that name.",
    );
  });

  it("links one workout to two programs with different sort orders and keeps workouts when a program is deleted", async () => {
    const strength = await createProgram("a", "Strength");
    const conditioning = await createProgram("a", "Conditioning");
    const anchor = await createWorkout("a", "Anchor day");
    const easy = await createWorkout("a", "Easy cardio");
    await call(programItemsPut, {
      method: "PUT",
      url: `/api/physical/programs/${strength.programId}/items`,
      user: "a",
      params: { id: String(strength.programId) },
      body: { workoutIds: [anchor.workoutId] },
    });
    const inStrength = (await call(programItemsPut, {
      method: "PUT",
      url: `/api/physical/programs/${strength.programId}/items`,
      user: "a",
      params: { id: String(strength.programId) },
      body: { workoutIds: [easy.workoutId] },
    })) as { program: { workouts: Array<{ workoutId: number; sortOrder: number; programs: Array<{ name: string }> }> } };
    const inConditioning = (await call(programItemsPut, {
      method: "PUT",
      url: `/api/physical/programs/${conditioning.programId}/items`,
      user: "a",
      params: { id: String(conditioning.programId) },
      body: { workoutIds: [easy.workoutId] },
    })) as { program: { workouts: Array<{ workoutId: number; sortOrder: number }> } };

    const strengthEasy = inStrength.program.workouts.find((item) => item.workoutId === easy.workoutId);
    const conditioningEasy = inConditioning.program.workouts.find((item) => item.workoutId === easy.workoutId);
    expect(strengthEasy?.sortOrder).toBe(1);
    expect(conditioningEasy?.sortOrder).toBe(0);
    const shared = (await call(programsGetOne, {
      url: `/api/physical/programs/${strength.programId}`,
      user: "a",
      params: { id: String(strength.programId) },
    })) as { program: { workouts: Array<{ workoutId: number; programs: Array<{ name: string }> }> } };
    expect(
      shared.program.workouts.find((item) => item.workoutId === easy.workoutId)?.programs.map((item) => item.name).sort(),
    ).toEqual(["Conditioning", "Strength"]);
    expect(db.workouts).toHaveLength(2);

    await call(programsDelete, {
      method: "DELETE",
      url: `/api/physical/programs/${strength.programId}`,
      user: "a",
      params: { id: String(strength.programId) },
    });
    expect(db.workouts.map((row) => row.name).sort()).toEqual(["Anchor day", "Easy cardio"]);
    expect(db.programs.map((row) => row.name)).toEqual(["Conditioning"]);
    expect(db.items.map((row) => Number(row.workout_id))).toEqual([easy.workoutId]);

    const afterDelete = (await call(programsGet, { url: "/api/physical/programs", user: "a" })) as {
      unassigned: { workouts: Array<{ name: string }> };
      programs: Array<{ name: string; workouts: Array<{ name: string }> }>;
    };
    expect(afterDelete.unassigned.workouts.map((item) => item.name)).toEqual(["Anchor day"]);
    expect(afterDelete.programs[0].workouts.map((item) => item.name)).toEqual(["Easy cardio"]);

    await call(programItemsDelete, {
      method: "DELETE",
      url: `/api/physical/programs/${conditioning.programId}/items/${easy.workoutId}`,
      user: "a",
      params: { id: String(conditioning.programId), workoutId: String(easy.workoutId) },
      body: undefined,
    });
    const unassigned = (await call(programsGet, { url: "/api/physical/programs", user: "a" })) as {
      unassigned: { workouts: Array<{ name: string }> };
      programs: Array<{ workoutCount: number }>;
    };
    expect(unassigned.programs[0].workoutCount).toBe(0);
    expect(unassigned.unassigned.workouts.map((item) => item.name).sort()).toEqual(["Anchor day", "Easy cardio"]);
  });

  it("bulk add is idempotent, orders by week and day, and does not rewrite exercises", async () => {
    const program = await createProgram("a", "16-week program");
    const loaded = await createWorkout("a", "Loaded day");
    db.exercises.push({
      workout_exercise_id: 900,
      workout_id: loaded.workoutId,
      exercise_id: "ex-squat",
      sort_order: 0,
      sets: 3,
      reps: 5,
      weight: 100,
      weight_unit: "lb",
      rest_seconds: null,
      duration_seconds: null,
      notes: null,
    });
    const before = db.exercises.map((row) => ({ ...row }));
    db.exerciseWrites = [];

    const later = await createWorkout("a", "Title · Week 2 Day 1 · Day 1");
    const earlier = await createWorkout("a", "Title · Week 1 Day 1 · Day 1");
    const body = { workoutIds: [later.workoutId, earlier.workoutId, loaded.workoutId] };
    const first = (await call(programItemsPut, {
      method: "PUT",
      url: `/api/physical/programs/${program.programId}/items`,
      user: "a",
      params: { id: String(program.programId) },
      body,
    })) as { program: { workouts: Array<{ workoutId: number; sortOrder: number }> } };
    await call(programItemsPut, {
      method: "PUT",
      url: `/api/physical/programs/${program.programId}/items`,
      user: "a",
      params: { id: String(program.programId) },
      body,
    });

    expect(first.program.workouts.map((item) => [item.workoutId, item.sortOrder])).toEqual([
      [earlier.workoutId, 101],
      [later.workoutId, 201],
      [loaded.workoutId, 202],
    ]);
    expect(db.items.filter((row) => Number(row.program_id) === program.programId)).toHaveLength(3);
    expect(db.exerciseWrites).toEqual([]);
    expect(db.exercises).toEqual(before);
  });

  it("refuses another user's workout or program", async () => {
    const ownProgram = await createProgram("a", "Mine");
    const otherProgram = await createProgram("b", "Theirs");
    const ownWorkout = await createWorkout("a", "My day");
    const otherWorkout = await createWorkout("b", "Their day");

    await expectStatus(
      call(programItemsPut, {
        method: "PUT",
        url: `/api/physical/programs/${ownProgram.programId}/items`,
        user: "a",
        params: { id: String(ownProgram.programId) },
        body: { workoutIds: [otherWorkout.workoutId] },
      }),
      404,
      "Workout not found.",
    );
    await expectStatus(
      call(programItemsPut, {
        method: "PUT",
        url: `/api/physical/programs/${otherProgram.programId}/items`,
        user: "a",
        params: { id: String(otherProgram.programId) },
        body: { workoutIds: [ownWorkout.workoutId] },
      }),
      404,
      "Program not found.",
    );
    await expectStatus(
      call(programsGetOne, {
        url: `/api/physical/programs/${otherProgram.programId}`,
        user: "a",
        params: { id: String(otherProgram.programId) },
      }),
      404,
      "Program not found.",
    );
    await expectStatus(
      call(programsPut, {
        method: "PUT",
        url: `/api/physical/programs/${otherProgram.programId}`,
        user: "a",
        params: { id: String(otherProgram.programId) },
        body: { name: "Stolen" },
      }),
      404,
      "Program not found.",
    );

    const listed = (await call(programsGet, { url: "/api/physical/programs", user: "a" })) as {
      programs: Array<{ name: string }>;
    };
    expect(listed.programs.map((item) => item.name)).toEqual(["Mine"]);
    expect(db.items).toEqual([]);
  });

  it("links a workout created inside a program and leaves the other user's program alone", async () => {
    const program = await createProgram("a", "Home program");
    const other = await createProgram("b", "Other program");
    const before = db.workouts.length;
    const created = await createWorkout("a", "Day inside", program.programId);
    expect(created.programs.map((item) => item.programId)).toEqual([program.programId]);
    const listed = (await call(programsGet, { url: "/api/physical/programs", user: "a" })) as {
      unassigned: { workoutCount: number };
      programs: Array<{ workouts: Array<{ name: string }> }>;
    };
    expect(listed.unassigned.workoutCount).toBe(0);
    expect(listed.programs[0].workouts.map((item) => item.name)).toEqual(["Day inside"]);

    await expectStatus(
      call(workoutsPost, {
        method: "POST",
        url: "/api/physical/workouts",
        user: "a",
        body: { name: "Should not save", exercises: [], programId: other.programId },
      }),
      404,
      "Program not found.",
    );
    expect(db.workouts).toHaveLength(before + 1);
  });

  it("reorders only the workouts already in the program", async () => {
    const program = await createProgram("a", "Order");
    const first = await createWorkout("a", "First");
    const second = await createWorkout("a", "Second");
    await call(programItemsPut, {
      method: "PUT",
      url: `/api/physical/programs/${program.programId}/items`,
      user: "a",
      params: { id: String(program.programId) },
      body: { workoutIds: [first.workoutId, second.workoutId] },
    });
    const reordered = (await call(programReorder, {
      method: "PUT",
      url: `/api/physical/programs/${program.programId}/reorder`,
      user: "a",
      params: { id: String(program.programId) },
      body: { workoutIds: [second.workoutId, first.workoutId] },
    })) as { program: { workouts: Array<{ name: string }> } };
    expect(reordered.program.workouts.map((item) => item.name)).toEqual(["Second", "First"]);
    await expectStatus(
      call(programReorder, {
        method: "PUT",
        url: `/api/physical/programs/${program.programId}/reorder`,
        user: "a",
        params: { id: String(program.programId) },
        body: { workoutIds: [second.workoutId] },
      }),
      400,
    );
  });

  it("saves a plan as a program and disambiguates a name that already exists", async () => {
    await createProgram("a", "Fat burn");
    const saved = (await call(planSave, {
      method: "POST",
      url: "/api/physical/workouts/plan-save",
      user: "a",
      body: {
        name: "Fat burn",
        description: "Short fat burn block.",
        days: [
          { name: "Week 1 Day 2 · Day 2", exercises: [{ exerciseId: "ex-squat", name: "Squat", sets: 3, reps: 8 }] },
          { name: "Week 1 Day 1 · Day 1", exercises: [{ exerciseId: "ex-squat", name: "Squat", sets: 3, reps: 8 }] },
          { name: "Week 1 Day 3 · Day 3", exercises: [{ name: "Not in catalog" }] },
        ],
      },
    })) as { program: { name: string }; workouts: Array<{ name: string }> };
    expect(saved.program.name).toBe("Fat burn (2)");
    expect(saved.workouts).toHaveLength(2);
    const listed = (await call(programsGetOne, {
      url: "/api/physical/programs/1",
      user: "a",
      params: { id: String(saved.program.programId) },
    })) as { program: { workouts: Array<{ name: string; sortOrder: number }> } };
    expect(listed.program.workouts.map((item) => [item.name, item.sortOrder])).toEqual([
      ["Fat burn · Week 1 Day 1 · Day 1", 101],
      ["Fat burn · Week 1 Day 2 · Day 2", 102],
    ]);
  });
});
