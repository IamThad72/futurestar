import { readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import {
  mapWorkoutWriteError,
  parseExerciseInputs,
  parseWorkoutId,
  parseWorkoutName,
  parseWorkoutNotes,
  updateWorkout,
} from "../../../utils/workouts";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const workoutId = parseWorkoutId(getRouterParam(event, "id"));
  const body = omitGroupScope((await readBody(event)) as Record<string, unknown>);
  const name = parseWorkoutName(body.name);
  const notes = parseWorkoutNotes(body.notes);
  const exercises = parseExerciseInputs(body.exercises);

  const client = createDbClient();
  try {
    await client.connect();
    const workout = await updateWorkout(client, userId, workoutId, { name, notes, exercises });
    return { workout };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("physical workout update failed", error);
    throw mapWorkoutWriteError(error, "Failed to save workout.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
