import { readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import {
  createIntakeEntry,
  mapNutritionWriteError,
  parseIntakeInput,
} from "../../../utils/nutritionIntake";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const body = omitGroupScope((await readBody(event)) as Record<string, unknown>);
  const input = parseIntakeInput(body || {});

  const client = createDbClient();
  try {
    await client.connect();
    const entry = await createIntakeEntry(client, userId, input);
    return { entry };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("physical nutrition intake create failed", error);
    throw mapNutritionWriteError(error, "Failed to log food.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
