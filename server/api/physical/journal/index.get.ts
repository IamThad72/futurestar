import { createError, getQuery } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import { isMissingRelation } from "../../../utils/workouts";
import { listJournalSessions } from "../../../utils/workoutJournal";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const query = omitGroupScope(getQuery(event) as Record<string, unknown>);
  const limitRaw = query.limit != null ? Number(query.limit) : 40;

  const client = createDbClient();
  try {
    await client.connect();
    const sessions = await listJournalSessions(client, userId, limitRaw);
    return { sessions };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    if (isMissingRelation(error)) {
      throw createError({
        statusCode: 500,
        statusMessage: "Workout journal is not set up yet. Run database migrations.",
      });
    }
    console.error("physical journal list failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load journal sessions." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
