import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../utils/privateUserAccess";
import { todayIsoDate } from "~/utils/liturgicalCalendar";
import {
  DEFAULT_LITURGICAL_CALENDAR_ID,
  emptyCatalogMessage,
  isCatalogUnavailable,
  isIsoDate,
  listLiturgicalRange,
  sundaySaturdayBounds,
} from "../../utils/liturgicalCalendar";

export default defineEventHandler(async (event) => {
  await requirePrivateUserId(event);
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
    const days = await listLiturgicalRange(client, {
      calendarId,
      start: bounds.start,
      end: bounds.end,
    });
    const seeded = days.length > 0;
    return {
      calendarId,
      date,
      start: bounds.start,
      end: bounds.end,
      seeded,
      message: seeded ? "" : emptyCatalogMessage("week"),
      days,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    if (isCatalogUnavailable(error)) {
      return {
        calendarId,
        date,
        start: bounds.start,
        end: bounds.end,
        seeded: false,
        message: emptyCatalogMessage("week"),
        days: [],
      };
    }
    console.error("spiritual week failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load this week's liturgical events." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
