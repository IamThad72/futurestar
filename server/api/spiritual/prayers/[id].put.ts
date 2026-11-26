import { getRouterParam, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import { clientToday, parseId, practicesError } from "../../../utils/faithPractices";
import { updatePrayer } from "../../../utils/prayerRequests";

/** { action?: "edit" | "answer" | "unanswer" | "archive" | "unarchive", ...fields, date? } */
export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const id = parseId(getRouterParam(event, "id"), "prayer request");
  const body = omitGroupScope((await readBody(event)) as Record<string, unknown>);
  const client = createDbClient();
  try {
    await client.connect();
    return { prayer: await updatePrayer(client, userId, id, body, clientToday(event, body.date)) };
  } catch (error: unknown) {
    practicesError(error, "Failed to update the prayer request.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
