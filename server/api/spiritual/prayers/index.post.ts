import { readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import { clientToday, practicesError } from "../../../utils/faithPractices";
import { createPrayer } from "../../../utils/prayerRequests";

/** { title, notes?, person?, category?, date? } */
export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const body = omitGroupScope((await readBody(event)) as Record<string, unknown>);
  const client = createDbClient();
  try {
    await client.connect();
    return { prayer: await createPrayer(client, userId, body, clientToday(event, body.date)) };
  } catch (error: unknown) {
    practicesError(error, "Failed to save the prayer request.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
