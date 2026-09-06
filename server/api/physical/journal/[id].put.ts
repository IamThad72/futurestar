import { readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import {
  mapJournalWriteError,
  parseJournalExerciseInputs,
  parseOptionalName,
  parsePerformedAt,
  parseSessionId,
  updateJournalSession,
} from "../../../utils/workoutJournal";
import { parseWorkoutNotes } from "../../../utils/workouts";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const sessionId = parseSessionId(getRouterParam(event, "id"));
  const body = omitGroupScope((await readBody(event)) as Record<string, unknown>);
  const performedAt = parsePerformedAt(body.performedAt ?? body.performed_at);
  const name = parseOptionalName(body.name);
  const notes = parseWorkoutNotes(body.notes);
  const exercises = parseJournalExerciseInputs(body.exercises);

  const client = createDbClient();
  try {
    await client.connect();
    const session = await updateJournalSession(client, userId, sessionId, {
      performedAt,
      name,
      notes,
      exercises,
    });
    return { session };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("physical journal update failed", error);
    throw mapJournalWriteError(error, "Failed to save journal session.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
