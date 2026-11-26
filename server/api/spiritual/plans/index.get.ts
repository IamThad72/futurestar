import { getQuery } from "h3";
import { createDbClient } from "../../../utils/db";
import { requirePrivateUserId } from "../../../utils/privateUserAccess";
import { readFaithProfile } from "../../../utils/faithProfile";
import { clientToday, logPracticesSetup, practicesError, practicesUnavailable, PRACTICES_SETUP_MESSAGE } from "../../../utils/faithPractices";
import { listEnrollments, planLibrary } from "../../../utils/readingPlans";

/** The plan library for your tradition and your plans. `?active=1` returns running plans only (Today card). */
export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const today = clientToday(event);
  const activeOnly = String(getQuery(event).active || "") === "1";
  const client = createDbClient();
  try {
    await client.connect();
    const { profile } = await readFaithProfile(client, userId);
    const library = activeOnly ? [] : planLibrary(profile, today);
    try {
      const plans = await listEnrollments(client, userId, today, { activeOnly });
      return { unavailable: false, message: "", today, library, plans };
    } catch (error) {
      if (practicesUnavailable(error)) {
        logPracticesSetup(error);
        return { unavailable: true, message: PRACTICES_SETUP_MESSAGE, today, library, plans: [] };
      }
      throw error;
    }
  } catch (error: unknown) {
    practicesError(error, "Failed to load reading plans.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
