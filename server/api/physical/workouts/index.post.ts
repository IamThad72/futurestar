import { readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import {
  createWorkout,
  mapWorkoutWriteError,
  parseExerciseInputs,
  parseWorkoutName,
  parseWorkoutNotes,
} from "../../../utils/workouts";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const body = omitGroupScope((await readBody(event)) as Record<string, unknown>);
  const name = parseWorkoutName(body.name);
  const notes = parseWorkoutNotes(body.notes);
  const exercises = parseExerciseInputs(body.exercises);

  const client = createDbClient();
  try {
    await client.connect();
    const workout = await createWorkout(client, userId, { name, notes, exercises });
    return { workout };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("physical workouts create failed", error);
    throw mapWorkoutWriteError(error, "Failed to save workout.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
