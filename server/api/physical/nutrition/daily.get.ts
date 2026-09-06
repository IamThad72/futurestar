import { getQuery } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import {
  buildNutritionComparison,
  getActiveNutritionPlan,
  getDailyMacros,
  listIntakeEntries,
  mapNutritionWriteError,
  parseEatenOn,
} from "../../../utils/nutritionIntake";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const query = omitGroupScope(getQuery(event) as Record<string, unknown>);
  const eatenOn = parseEatenOn(query.date || query.eaten_on);

  const client = createDbClient();
  try {
    await client.connect();
    const [macros, entries, plan] = await Promise.all([
      getDailyMacros(client, userId, eatenOn),
      listIntakeEntries(client, userId, eatenOn),
      getActiveNutritionPlan(client, userId),
    ]);
    return {
      eaten_on: eatenOn,
      macros,
      entries,
      plan,
      comparison: buildNutritionComparison(macros, plan),
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("physical nutrition daily failed", error);
    throw mapNutritionWriteError(error, "Failed to load nutrition intake.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
