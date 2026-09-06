import { readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import {
  mapNutritionWriteError,
  parsePlanInput,
  upsertActiveNutritionPlan,
} from "../../../utils/nutritionIntake";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const body = omitGroupScope((await readBody(event)) as Record<string, unknown>);
  const input = parsePlanInput(body || {});

  const client = createDbClient();
  try {
    await client.connect();
    const plan = await upsertActiveNutritionPlan(client, userId, input);
    return { plan };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("physical nutrition plan put failed", error);
    throw mapNutritionWriteError(error, "Failed to save nutrition plan.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
