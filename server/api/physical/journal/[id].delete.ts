import { createDbClient } from "../../../utils/db";
import { requirePrivateUserId } from "../../../utils/privateUserAccess";
import { deleteJournalSession, mapJournalWriteError, parseSessionId } from "../../../utils/workoutJournal";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const sessionId = parseSessionId(getRouterParam(event, "id"));

  const client = createDbClient();
  try {
    await client.connect();
    await deleteJournalSession(client, userId, sessionId);
    return { success: true };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("physical journal delete failed", error);
    throw mapJournalWriteError(error, "Failed to delete journal session.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
