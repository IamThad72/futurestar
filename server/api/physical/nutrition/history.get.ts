import { getQuery } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import {
  addCalendarDays,
  listDailyMacrosRange,
  mapNutritionWriteError,
  parseEatenOn,
  parseHistoryDays,
} from "../../../utils/nutritionIntake";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const query = omitGroupScope(getQuery(event) as Record<string, unknown>);
  const days = parseHistoryDays(query.days);
  const endOn = parseEatenOn(query.date || query.eaten_on || query.end || todayIso());
  const startOn = addCalendarDays(endOn, -(days - 1));

  const client = createDbClient();
  try {
    await client.connect();
    const rows = await listDailyMacrosRange(client, userId, startOn, endOn);
    return {
      start_on: startOn,
      end_on: endOn,
      days: rows,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("physical nutrition history failed", error);
    throw mapNutritionWriteError(error, "Failed to load nutrition history.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
