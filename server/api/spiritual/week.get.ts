import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../utils/privateUserAccess";
import { todayIsoDate } from "~/utils/liturgicalCalendar";
import {
  DEFAULT_LITURGICAL_CALENDAR_ID,
  isIsoDate,
  listCalendarRangeForUser,
  sundaySaturdayBounds,
} from "../../utils/liturgicalCalendar";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const query = omitGroupScope(getQuery(event) as Record<string, unknown>);
  const date = String(query.date || todayIsoDate()).trim();
  const calendarId = String(query.calendar || query.calendar_id || DEFAULT_LITURGICAL_CALENDAR_ID).trim()
    || DEFAULT_LITURGICAL_CALENDAR_ID;

  if (!isIsoDate(date)) {
    throw createError({ statusCode: 400, statusMessage: "date must be YYYY-MM-DD." });
  }

  const bounds = sundaySaturdayBounds(date);
  if (!bounds) {
    throw createError({ statusCode: 400, statusMessage: "date must be YYYY-MM-DD." });
  }

  const client = createDbClient();
  try {
    await client.connect();
    const result = await listCalendarRangeForUser(client, userId, {
      calendarId,
      start: bounds.start,
      end: bounds.end,
    });
    return {
      calendarId,
      mode: result.mode,
      tradition: result.tradition,
      date,
      start: bounds.start,
      end: bounds.end,
      seeded: true,
      message: "",
      days: result.days,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("spiritual week failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load this week's church calendar." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
