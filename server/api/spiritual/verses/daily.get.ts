import { createError, getQuery } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import { todayIsoDate } from "~/utils/liturgicalCalendar";
import { listDailyScripture } from "../../../utils/bible";
import { readFaithProfile, scriptureOptions } from "../../../utils/faithProfile";
import { parseReviewDate } from "../../../utils/spiritualReview";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const query = omitGroupScope(getQuery(event) as Record<string, unknown>);
  const date = parseReviewDate(query.date || todayIsoDate());
  const refreshRaw = query.refresh != null ? parseInt(String(query.refresh), 10) : 0;
  const refresh = Number.isFinite(refreshRaw) ? Math.min(Math.max(refreshRaw, 0), 50) : 0;

  const client = createDbClient();
  try {
    await client.connect();
    const { profile } = await readFaithProfile(client, userId);
    return await listDailyScripture(client, date, refresh, scriptureOptions(profile));
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("spiritual daily scripture failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load Scripture for the day." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
