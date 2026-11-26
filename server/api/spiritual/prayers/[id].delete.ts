import { getRouterParam } from "h3";
import { createDbClient } from "../../../utils/db";
import { requirePrivateUserId } from "../../../utils/privateUserAccess";
import { parseId, practicesError } from "../../../utils/faithPractices";
import { deletePrayer } from "../../../utils/prayerRequests";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const id = parseId(getRouterParam(event, "id"), "prayer request");
  const client = createDbClient();
  try {
    await client.connect();
    await deletePrayer(client, userId, id);
    return { ok: true };
  } catch (error: unknown) {
    practicesError(error, "Failed to delete the prayer request.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
