import { readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../utils/privateUserAccess";
import { readFaithProfile } from "../../utils/faithProfile";
import { clientToday, practicesError } from "../../utils/faithPractices";
import { saveCheckin, worshipOverview } from "../../utils/worshipCheckins";

/** { week_start?, attendance, church_name?, sermon_passage?, notes?, takeaway?, clear?, date? } */
export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const body = omitGroupScope((await readBody(event)) as Record<string, unknown>);
  const today = clientToday(event, body.date);
  const client = createDbClient();
  try {
    await client.connect();
    const { profile } = await readFaithProfile(client, userId);
    await saveCheckin(client, userId, body, today);
    return { unavailable: false, message: "", tradition: profile.tradition, ...(await worshipOverview(client, userId, today)) };
  } catch (error: unknown) {
    practicesError(error, "Failed to save the worship check-in.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
