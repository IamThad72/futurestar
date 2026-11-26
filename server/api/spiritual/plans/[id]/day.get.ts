import { getQuery, getRouterParam } from "h3";
import { createDbClient } from "../../../../utils/db";
import { requirePrivateUserId } from "../../../../utils/privateUserAccess";
import { readFaithProfile } from "../../../../utils/faithProfile";
import { parseId, practicesError } from "../../../../utils/faithPractices";
import { enrollmentDayReadings } from "../../../../utils/readingPlans";
import { getBibleCatalogStatus, getReadingTextWithFallback, resolveBibleSource } from "../../../../utils/bible";
import { translationName } from "~/utils/bibleTranslations.js";

/** Text for one plan day (?day=N) in your translation. Books your translation lacks come from the CPDV. */
export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const id = parseId(getRouterParam(event, "id"), "plan");
  const day = parseId(getQuery(event).day, "day");
  const client = createDbClient();
  try {
    await client.connect();
    const { profile } = await readFaithProfile(client, userId);
    const { row, status, readings } = await enrollmentDayReadings(client, userId, id, day);
    const { resolved, catalog } = await getBibleCatalogStatus(client, profile.translation);
    const source = resolved.source;
    const texts = [];
    for (const reading of readings) {
      const text = source
        ? await getReadingTextWithFallback(client, source, reading, row.include_deuterocanon, async () =>
          (await resolveBibleSource(client, "CPDV")).source)
        : null;
      texts.push({
        citation: reading.citation,
        book: reading.book,
        verses: text?.verses || [],
        translation: text ? translationName(text.translation) : "",
        translation_code: text?.translation || "",
        fallback: Boolean(text?.fallback),
      });
    }
    return { day, status, catalog, readings: texts };
  } catch (error: unknown) {
    practicesError(error, "Failed to load the reading.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
