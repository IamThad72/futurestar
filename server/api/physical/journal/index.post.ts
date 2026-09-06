import { readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import {
  createJournalSession,
  mapJournalWriteError,
  parseJournalExerciseInputs,
  parseOptionalName,
  parseOptionalWorkoutId,
  parsePerformedAt,
} from "../../../utils/workoutJournal";
import { parseWorkoutNotes } from "../../../utils/workouts";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const body = omitGroupScope((await readBody(event)) as Record<string, unknown>);
  const performedAt = parsePerformedAt(body.performedAt ?? body.performed_at);
  const name = parseOptionalName(body.name);
  const notes = parseWorkoutNotes(body.notes);
  const workoutId = parseOptionalWorkoutId(body.workoutId ?? body.workout_id);
  const exercises = parseJournalExerciseInputs(body.exercises);

  const client = createDbClient();
  try {
    await client.connect();
    const session = await createJournalSession(client, userId, {
      performedAt,
      name,
      notes,
      workoutId,
      exercises,
    });
    return { session };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("physical journal create failed", error);
    throw mapJournalWriteError(error, "Failed to start journal session.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
