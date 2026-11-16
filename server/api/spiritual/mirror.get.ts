import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../utils/privateUserAccess";
import { todayIsoDate, sundaySaturdayBounds } from "~/utils/liturgicalCalendar";
import { parseReviewDate, listSpiritualReviews } from "../../utils/spiritualReview";
import { generateNote } from "../../utils/aiNote";
import { mirrorFacts, mirrorSentence } from "~/utils/spiritualMirror.js";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const query = omitGroupScope(getQuery(event) as Record<string, unknown>);
  const date = parseReviewDate(query.date || todayIsoDate());
  const bounds = sundaySaturdayBounds(date);
  if (!bounds) throw createError({ statusCode: 400, statusMessage: "date must be YYYY-MM-DD." });

  const client = createDbClient();
  try {
    await client.connect();
    const reviews = await listSpiritualReviews(client, userId, bounds.start, bounds.end);
    const facts = mirrorFacts(reviews);
    const fallback = mirrorSentence(facts);
    const text =
      (await generateNote(
        "Write a private weekly mirror in two sentences from these counts. Do not give spiritual direction or add events that are not in the counts.",
        { start: bounds.start, end: bounds.end, ...facts },
      )) || fallback;
    return { start: bounds.start, end: bounds.end, facts, text };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("spiritual mirror failed", error);
    throw createError({ statusCode: 500, statusMessage: "Could not read this week." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
