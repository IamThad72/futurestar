import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../utils/privateUserAccess";
import { todayIsoDate } from "~/utils/liturgicalCalendar";
import { mergeSpiritualReview, parseReviewDate, parseReviewPatch } from "../../utils/spiritualReview";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const body = omitGroupScope((await readBody(event)) as Record<string, unknown>);
  const date = parseReviewDate(body.date || body.review_on || todayIsoDate());
  const patch = parseReviewPatch(body || {}, date);

  const client = createDbClient();
  try {
    await client.connect();
    const review = await mergeSpiritualReview(client, userId, patch);
    return { review };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("spiritual review save failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to save today's spiritual review." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
