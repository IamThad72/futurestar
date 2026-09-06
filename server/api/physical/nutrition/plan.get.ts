import { createDbClient } from "../../../utils/db";
import { requirePrivateUserId } from "../../../utils/privateUserAccess";
import { getActiveNutritionPlan, mapNutritionWriteError } from "../../../utils/nutritionIntake";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const client = createDbClient();
  try {
    await client.connect();
    const plan = await getActiveNutritionPlan(client, userId);
    return { plan };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("physical nutrition plan get failed", error);
    throw mapNutritionWriteError(error, "Failed to load nutrition plan.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
