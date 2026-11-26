import { createError, getQuery } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import { todayIsoDate } from "~/utils/liturgicalCalendar";
import { listMorningPrayers } from "../../../utils/bible";
import { readFaithProfile, scriptureOptions } from "../../../utils/faithProfile";
import { parseReviewDate } from "../../../utils/spiritualReview";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const query = omitGroupScope(getQuery(event) as Record<string, unknown>);
  const date = parseReviewDate(query.date || todayIsoDate());

  const client = createDbClient();
  try {
    await client.connect();
    const { profile } = await readFaithProfile(client, userId);
    return await listMorningPrayers(client, date, 3, scriptureOptions(profile));
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("spiritual morning prayers failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load morning prayers." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
