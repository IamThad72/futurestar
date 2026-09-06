import { createDbClient } from "../../../../utils/db";
import { requirePrivateUserId } from "../../../../utils/privateUserAccess";
import {
  deleteIntakeEntry,
  mapNutritionWriteError,
  parseEntryId,
} from "../../../../utils/nutritionIntake";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const entryId = parseEntryId(getRouterParam(event, "id"));

  const client = createDbClient();
  try {
    await client.connect();
    await deleteIntakeEntry(client, userId, entryId);
    return { success: true };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("physical nutrition intake delete failed", error);
    throw mapNutritionWriteError(error, "Failed to delete intake entry.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
