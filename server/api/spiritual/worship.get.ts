import { createDbClient } from "../../utils/db";
import { requirePrivateUserId } from "../../utils/privateUserAccess";
import { readFaithProfile } from "../../utils/faithProfile";
import { clientToday, logPracticesSetup, practicesError, practicesUnavailable, PRACTICES_SETUP_MESSAGE } from "../../utils/faithPractices";
import { worshipOverview } from "../../utils/worshipCheckins";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const today = clientToday(event);
  const client = createDbClient();
  try {
    await client.connect();
    const { profile } = await readFaithProfile(client, userId);
    try {
      return { unavailable: false, message: "", tradition: profile.tradition, ...(await worshipOverview(client, userId, today)) };
    } catch (error) {
      if (practicesUnavailable(error)) {
        logPracticesSetup(error);
        return {
          unavailable: true,
          message: PRACTICES_SETUP_MESSAGE,
          tradition: profile.tradition,
          week_start: "",
          current: null,
          history: [],
          streak: 0,
          last_church: "",
        };
      }
      throw error;
    }
  } catch (error: unknown) {
    practicesError(error, "Failed to load worship check-ins.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
