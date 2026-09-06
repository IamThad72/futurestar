import { createError } from "h3";
import { createDbClient } from "../../../utils/db";
import { requirePrivateUserId } from "../../../utils/privateUserAccess";
import { isMissingRelation } from "../../../utils/workouts";
import { getJournalSessionById, parseSessionId } from "../../../utils/workoutJournal";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const sessionId = parseSessionId(getRouterParam(event, "id"));

  const client = createDbClient();
  try {
    await client.connect();
    const session = await getJournalSessionById(client, userId, sessionId);
    if (!session) {
      throw createError({ statusCode: 404, statusMessage: "Journal session not found." });
    }
    return { session };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    if (isMissingRelation(error)) {
      throw createError({
        statusCode: 500,
        statusMessage: "Workout journal is not set up yet. Run database migrations.",
      });
    }
    console.error("physical journal get failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load journal session." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
