import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../utils/privateUserAccess";
import { todayIsoDate } from "~/utils/liturgicalCalendar";
import { getSpiritualReview, parseReviewDate } from "../../utils/spiritualReview";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const query = omitGroupScope(getQuery(event) as Record<string, unknown>);
  const date = parseReviewDate(query.date || todayIsoDate());

  const client = createDbClient();
  try {
    await client.connect();
    const review = await getSpiritualReview(client, userId, date);
    return { review };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("spiritual review get failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load today's spiritual review." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
