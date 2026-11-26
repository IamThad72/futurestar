import { getQuery } from "h3";
import { createDbClient } from "../../../utils/db";
import { requirePrivateUserId } from "../../../utils/privateUserAccess";
import { clientToday, logPracticesSetup, practicesError, practicesUnavailable, PRACTICES_SETUP_MESSAGE } from "../../../utils/faithPractices";
import { listPrayers, prayerCounts, prayersForToday } from "../../../utils/prayerRequests";

/**
 * ?view=active|answered|archived lists requests.
 * ?view=today returns up to ?count (default 3) open requests for Morning Prayer or the evening.
 */
export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const query = getQuery(event);
  const view = String(query.view || "active");
  const client = createDbClient();
  try {
    await client.connect();
    try {
      if (view === "today") {
        const count = Math.max(1, Math.min(5, Number(query.count) || 3));
        const counts = await prayerCounts(client, userId);
        return { unavailable: false, message: "", view, counts, prayers: await prayersForToday(client, userId, clientToday(event), count) };
      }
      const [prayers, counts] = [await listPrayers(client, userId, view), await prayerCounts(client, userId)];
      return { unavailable: false, message: "", view, counts, prayers };
    } catch (error) {
      if (practicesUnavailable(error)) {
        logPracticesSetup(error);
        return { unavailable: true, message: PRACTICES_SETUP_MESSAGE, view, counts: { active: 0, answered: 0, archived: 0 }, prayers: [] };
      }
      throw error;
    }
  } catch (error: unknown) {
    practicesError(error, "Failed to load the prayer list.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
