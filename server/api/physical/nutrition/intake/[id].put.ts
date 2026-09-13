import { readBody } from "h3";
import { createDbClient } from "../../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../../utils/privateUserAccess";
import {
  mapNutritionWriteError,
  parseEntryId,
  parseIntakeInput,
  updateIntakeEntry,
} from "../../../../utils/nutritionIntake";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const entryId = parseEntryId(getRouterParam(event, "id"));
  const body = omitGroupScope((await readBody(event)) as Record<string, unknown>);
  const input = parseIntakeInput(body || {});

  const client = createDbClient();
  try {
    await client.connect();
    const entry = await updateIntakeEntry(client, userId, entryId, input);
    return { entry };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("physical nutrition intake update failed", error);
    throw mapNutritionWriteError(error, "Failed to update food log entry.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
