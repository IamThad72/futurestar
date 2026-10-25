import { createError, getQuery } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import { isMissingRelation } from "../../../utils/workouts";
import { listPreviousExercises } from "../../../utils/workoutJournal";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const query = omitGroupScope(getQuery(event) as Record<string, unknown>);
  const excludeRaw = Number(query.exclude);
  const excludeSessionId = Number.isInteger(excludeRaw) && excludeRaw > 0 ? excludeRaw : null;

  const client = createDbClient();
  try {
    await client.connect();
    const previous = await listPreviousExercises(client, userId, excludeSessionId);
    return { previous };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    if (isMissingRelation(error)) {
      throw createError({
        statusCode: 500,
        statusMessage: "Workout journal is not set up yet. Run database migrations.",
      });
    }
    console.error("physical journal previous failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load previous sets." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
