import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../utils/privateUserAccess";
import {
  DEFAULT_LITURGICAL_CALENDAR_ID,
  listCalendarRangeForUser,
  monthDateBounds,
} from "../../utils/liturgicalCalendar";

function utcYearMonth() {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const query = omitGroupScope(getQuery(event) as Record<string, unknown>);
  const fallback = utcYearMonth();
  const yearRaw = query.year != null ? parseInt(String(query.year), 10) : fallback.year;
  const monthRaw = query.month != null ? parseInt(String(query.month), 10) : fallback.month;
  const calendarId = String(query.calendar || query.calendar_id || DEFAULT_LITURGICAL_CALENDAR_ID).trim()
    || DEFAULT_LITURGICAL_CALENDAR_ID;

  if (!Number.isFinite(yearRaw) || yearRaw < 1900 || yearRaw > 2100) {
    throw createError({ statusCode: 400, statusMessage: "year must be between 1900 and 2100." });
  }
  if (!Number.isFinite(monthRaw) || monthRaw < 1 || monthRaw > 12) {
    throw createError({ statusCode: 400, statusMessage: "month must be between 1 and 12." });
  }

  const { start, end } = monthDateBounds(yearRaw, monthRaw);
  const client = createDbClient();
  try {
    await client.connect();
    const result = await listCalendarRangeForUser(client, userId, { calendarId, start, end });
    return {
      calendarId,
      mode: result.mode,
      tradition: result.tradition,
      year: yearRaw,
      month: monthRaw,
      start,
      end,
      seeded: true,
      message: "",
      days: result.days,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("spiritual calendar failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load the church calendar." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
