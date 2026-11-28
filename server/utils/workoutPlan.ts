import { createError } from "h3";
import type { Client } from "pg";
import { generateJson } from "./groq";
import { createWorkout, mapWorkoutWriteError, parseExerciseInputs, parseWorkoutName, parseWorkoutNotes } from "./workouts";
import { addProgramItems, createProgramForPlan } from "./workoutPrograms";
import { privateUserClause } from "./privateUserAccess";
import {
  applyCatalogMatches,
  applyDescriptionSchedule,
  catalogNameMatch,
  collectAdditions,
  descriptionWords,
  excludesAvoid,
  expandSchedule,
  normalizeBlocks,
  normalizeProgression,
  parsePlanRequest,
  pickCandidates,
  prescribedMoves,
  applyPrescriptions,
} from "~/utils/workoutPlan.js";

type PlanRequest = ReturnType<typeof parsePlanRequest>;

const INSTRUCTION = `Build a training plan from the user's description.
Return JSON with name, summary, blocks, and progression.
Prefer one block when the same weekly sessions repeat. Use up to four blocks when the description changes the work, such as a strength block and then a conditioning block.
Each block has fromWeek, toWeek, and days. days length must equal daysPerWeek. Each day needs a name and exercises.
The app copies each block across its weeks and lists every training day. Do not write a separate day for every week.
Each exercise has name. Use exerciseId only when it is one of the candidates, and use that candidate's name.
If the description needs a movement that is not in the candidates, put it on the day with name and equipment and leave exerciseId empty.
Each exercise needs description: one or two sentences on what it is for in this plan and how to perform the main movement. Do not ask about current fitness.
Use sets and reps for strength. A request for 50 push-ups is reps 50, not 50 sets. A 50 second plank is durationSeconds 50.
Use durationSeconds instead of reps for conditioning or mobility.
Leave out every exercise named in avoid.
restSeconds is the rest after a set.
Keep each day inside the requested minutes. Count about 40 seconds of work per strength set, plus rest.
progression covers week 1 through durationWeeks. Each phase has fromWeek, toWeek, and change.
change says how those weeks get harder: more reps, a little more weight, more time, or shorter rest.
For weight loss, keep strength work and put conditioning in most sessions. Do not prescribe a diet.
Do not invent exercise ids.`;

function candidateRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => ({
    exerciseId: String(row.exercise_id || ""),
    name: String(row.name || ""),
    equipment: String(row.equipment_key || ""),
    bodyParts: row.body_parts,
    targetMuscles: row.target_muscles,
  }));
}

async function loadRows(client: Client, equipment: string[]) {
  const result = await client.query(
    `SELECT exercise_id, name, equipment_key, target_muscles, body_parts
     FROM exercise_catalog
     WHERE equipment_key = ANY($1::text[])
     ORDER BY lower(name)
     LIMIT 800`,
    [equipment],
  );
  return candidateRows(result.rows);
}

async function loadMentioned(client: Client, words: string[]) {
  const patterns = words
    .map((word) => `%${word.toLowerCase().replace(/[%_\\]/g, "")}%`)
    .filter((pattern) => pattern.length > 2);
  if (!patterns.length) return [];
  const result = await client.query(
    `SELECT exercise_id, name, equipment_key, target_muscles, body_parts
     FROM exercise_catalog
     WHERE lower(name) LIKE ANY($1::text[])
     ORDER BY lower(name)
     LIMIT 40`,
    [patterns],
  );
  return candidateRows(result.rows);
}

function mergeRows<T extends { exerciseId: string }>(primary: T[], extra: T[]) {
  const seen = new Set(primary.map((item) => item.exerciseId));
  const merged = [...primary];
  for (const item of extra) {
    if (!item.exerciseId || seen.has(item.exerciseId)) continue;
    seen.add(item.exerciseId);
    merged.push(item);
  }
  return merged;
}

async function loadRecent(client: Client, userId: number) {
  try {
    const result = await client.query(
      `SELECT DISTINCT ON (e.exercise_id)
              e.exercise_id, e.exercise_name, st.reps, st.weight, st.duration_seconds
       FROM workout_journal_exercises e
       JOIN workout_journal_sessions s ON s.session_id = e.session_id
       LEFT JOIN workout_journal_sets st ON st.journal_exercise_id = e.journal_exercise_id
       WHERE ${privateUserClause("s")}
         AND e.exercise_id IS NOT NULL
       ORDER BY e.exercise_id, s.performed_at DESC
       LIMIT 8`,
      [userId],
    );
    return result.rows.map((row) => ({
      exerciseId: String(row.exercise_id),
      name: String(row.exercise_name || ""),
      reps: row.reps == null ? null : Number(row.reps),
      weight: row.weight == null ? null : Number(row.weight),
      durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    }));
  } catch {
    return [];
  }
}

type PlanAddition = { name: string; equipment: string; reason: string; description: string };

async function resolveAdditions(client: Client, additions: PlanAddition[]) {
  const resolved = [];
  for (const item of additions) {
    const found = await client.query(
      `SELECT exercise_id, name, equipment_key
       FROM exercise_catalog
       WHERE lower(name) = lower($1) OR lower(name) LIKE $2
       LIMIT 8`,
      [item.name, `%${item.name.toLowerCase().replace(/[%_\\]/g, "")}%`],
    );
    const match = catalogNameMatch(
      item.name,
      found.rows.map((row) => ({
        exerciseId: String(row.exercise_id),
        name: String(row.name),
        equipment: String(row.equipment_key || ""),
      })),
    );
    resolved.push({
      ...item,
      exerciseId: match ? String(match.exerciseId || match.exercise_id || "") : null,
      matchedName: match ? String(match.name || "") : null,
    });
  }
  return resolved;
}

function planName(draftName: string, description: string) {
  return draftName || description.split(/[.\n]/)[0].trim().slice(0, 80) || "Workout plan";
}

export async function generateWorkoutPlan(client: Client, userId: number, body: unknown) {
  const request = applyDescriptionSchedule(parsePlanRequest(body));
  if (request.description.length < 12) {
    throw createError({ statusCode: 400, statusMessage: "Describe the plan you want." });
  }
  const rows = (await loadRows(client, request.equipment)).filter((row) => !excludesAvoid(row.name, request.avoidTerms));
  const mentioned = (await loadMentioned(client, descriptionWords(request.description))).filter(
    (row) => !excludesAvoid(row.name, request.avoidTerms),
  );
  const catalog = mergeRows(rows, mentioned);
  const recent = await loadRecent(client, userId);
  const candidates = mergeRows(
    pickCandidates(rows, recent.map((item) => item.exerciseId), 6),
    mentioned,
  ).slice(0, 80);
  if (!candidates.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "No catalog exercises match that equipment.",
    });
  }

  const payload = {
    description: request.description,
    goal: request.goal,
    daysPerWeek: request.daysPerWeek,
    minutes: request.minutes,
    minuteFloor: request.minuteFloor,
    durationWeeks: request.durationWeeks,
    durationLabel: request.durationLabel,
    scheduleDays: request.scheduleDays,
    avoid: request.avoid,
    recent,
    candidates: candidates.map((item) => ({
      exerciseId: item.exerciseId,
      name: item.name,
      equipment: item.equipment,
    })),
  };

  const prescription = prescribedMoves(request.description);
  const withDoses = (value) => {
    const blocks = applyPrescriptions(value.blocks, prescription);
    const budget = Math.max(request.minutes, 1) * 60 * 1.15;
    return {
      ...value,
      blocks,
      overTime: blocks.some((block) => block.days.some((day) => day.seconds > budget)),
    };
  };

  let raw = await generateJson(INSTRUCTION, payload);
  let draft = withDoses(normalizeBlocks(raw, catalog, request.minutes, request.daysPerWeek, request.durationWeeks));
  if (draft.overTime && draft.blocks.length) {
    const retryRaw = await generateJson(INSTRUCTION, {
      ...payload,
      previousWasTooLong: true,
      previousBlocks: draft.blocks.map((block) => ({
        fromWeek: block.fromWeek,
        toWeek: block.toWeek,
        days: block.days.map((day) => ({ name: day.name, seconds: day.seconds })),
      })),
    });
    const retry = withDoses(normalizeBlocks(retryRaw, catalog, request.minutes, request.daysPerWeek, request.durationWeeks));
    if (retry.blocks.length) {
      raw = retryRaw;
      draft = retry;
    }
  }
  if (!draft.blocks.length) {
    const keys = raw && typeof raw === "object" ? Object.keys(raw as object).slice(0, 8).join(",") : typeof raw;
    console.error("workout plan had no sessions", keys);
    throw createError({ statusCode: 502, statusMessage: "The model did not return a session for each training day." });
  }

  const found = await resolveAdditions(client, collectAdditions(draft.blocks));
  const blocks = applyCatalogMatches(draft.blocks, found);
  const progression = normalizeProgression(raw, request.durationWeeks);
  const days = expandSchedule(blocks, request.durationWeeks, progression);
  if (!days.length) {
    throw createError({ statusCode: 502, statusMessage: "The model did not return a usable plan." });
  }

  return {
    name: planName(draft.name, request.description),
    description: request.description,
    goal: request.goal,
    minutes: request.minutes,
    durationCount: request.durationCount,
    durationUnit: request.durationUnit,
    durationWeeks: request.durationWeeks,
    durationLabel: request.durationLabel,
    scheduleDays: days.length,
    summary: draft.summary,
    overTime: draft.overTime,
    days,
    progression,
    additions: found.filter((item) => !item.exerciseId),
  };
}

function slug(name: string) {
  const text = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return (text || "exercise").slice(0, 40);
}

async function insertAddition(client: Client, item: { name: string; equipment: string; description?: string; reason?: string }) {
  const exerciseId = `assistant-${slug(item.name)}`;
  const overview = String(item.description || item.reason || "").trim().slice(0, 400) || null;
  await client.query(
    `INSERT INTO exercise_catalog (
       exercise_id, name, overview, body_parts, target_muscles, secondary_muscles, equipments,
       instructions, exercise_types, equipment_key, source
     ) VALUES ($1, $2, $3, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $4::jsonb, '[]'::jsonb, '[]'::jsonb, $5, 'assistant')
     ON CONFLICT (exercise_id) DO NOTHING`,
    [exerciseId, item.name, overview, JSON.stringify([item.equipment]), item.equipment],
  );
  return exerciseId;
}

function savedWorkoutName(title: string, dayName: string) {
  const prefix = `${title} · `;
  const room = Math.max(120 - prefix.length, 1);
  return `${prefix}${String(dayName || "Day").slice(0, room)}`.slice(0, 120);
}

export async function saveWorkoutPlan(client: Client, userId: number, body: unknown) {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const request = parsePlanRequest(raw);
  const daysIn = Array.isArray(raw.days) ? raw.days : [];
  if (!daysIn.length) {
    throw createError({ statusCode: 400, statusMessage: "Choose a plan before saving." });
  }

  const idByName = new Map<string, string>();
  const additionsIn = Array.isArray(raw.additions) ? raw.additions : [];
  for (const item of additionsIn) {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    if (row.include === false) continue;
    const name = String(row.name || "").trim();
    if (!name) continue;
    const [resolved] = await resolveAdditions(client, [
      {
        name,
        equipment: String(row.equipment || "body"),
        reason: String(row.reason || ""),
        description: String(row.description || ""),
      },
    ]);
    if (!resolved) continue;
    const exerciseId = resolved.exerciseId || (await insertAddition(client, resolved));
    idByName.set(name.toLowerCase(), exerciseId);
  }

  const title = String(raw.name || "Workout plan").trim().slice(0, 48) || "Workout plan";
  const saved = [];
  for (let index = 0; index < daysIn.length; index += 1) {
    const day = daysIn[index] && typeof daysIn[index] === "object" ? (daysIn[index] as Record<string, unknown>) : {};
    const sourceLines = Array.isArray(day.exercises) ? day.exercises : [];
    const ready = [];
    for (const line of sourceLines) {
      const row = line && typeof line === "object" ? (line as Record<string, unknown>) : {};
      const named = String(row.name || "").trim().toLowerCase();
      const exerciseId = String(row.exerciseId || "").trim() || idByName.get(named) || "";
      if (!exerciseId) continue;
      ready.push({ ...row, exerciseId });
    }
    if (!ready.length) continue;
    const lines = parseExerciseInputs(ready);
    const notes = parseWorkoutNotes(
      [day.progression ? `This week: ${day.progression}` : "", request.description].filter(Boolean).join("\n\n"),
    );
    const baseName = parseWorkoutName(savedWorkoutName(title, String(day.name || `Day ${index + 1}`)));
    let workout;
    try {
      workout = await createWorkout(client, userId, { name: baseName, notes, exercises: lines });
    } catch (error) {
      const mapped = mapWorkoutWriteError(error, "Could not save the plan.");
      if (mapped.statusCode !== 400) throw mapped;
      workout = await createWorkout(client, userId, {
        name: parseWorkoutName(savedWorkoutName(`${title} plan`, String(day.name || `Day ${index + 1}`))),
        notes,
        exercises: lines,
      });
    }
    saved.push({ workoutId: workout.workoutId, name: workout.name, exerciseCount: workout.exercises.length });
  }
  if (!saved.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "Nothing to save. Add the highlighted exercises, or draft the plan again.",
    });
  }
  const program = await createProgramForPlan(client, userId, title, parseWorkoutNotes(request.description));
  await addProgramItems(
    client,
    userId,
    program.programId,
    saved.map((item) => item.workoutId),
  );
  return { workouts: saved, program: { programId: program.programId, name: program.name } };
}
