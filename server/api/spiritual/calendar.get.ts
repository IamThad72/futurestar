import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../utils/privateUserAccess";
import {
  DEFAULT_LITURGICAL_CALENDAR_ID,
  emptyCatalogMessage,
  isCatalogUnavailable,
  listLiturgicalRange,
  monthDateBounds,
} from "../../utils/liturgicalCalendar";

function utcYearMonth() {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export default defineEventHandler(async (event) => {
  await requirePrivateUserId(event);
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
    const days = await listLiturgicalRange(client, { calendarId, start, end });
    const seeded = days.length > 0;
    return {
      calendarId,
      year: yearRaw,
      month: monthRaw,
      start,
      end,
      seeded,
      message: seeded ? "" : emptyCatalogMessage("month"),
      days,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    if (isCatalogUnavailable(error)) {
      return {
        calendarId,
        year: yearRaw,
        month: monthRaw,
        start,
        end,
        seeded: false,
        message: emptyCatalogMessage("month"),
        days: [],
      };
    }
    console.error("spiritual calendar failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load the liturgical calendar." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
