import { getRouterParam } from "h3";
import { createDbClient } from "../../../utils/db";
import { requirePrivateUserId } from "../../../utils/privateUserAccess";
import { clientToday, parseId, practicesError } from "../../../utils/faithPractices";
import { getEnrollmentDetail } from "../../../utils/readingPlans";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const id = parseId(getRouterParam(event, "id"), "plan");
  const today = clientToday(event);
  const client = createDbClient();
  try {
    await client.connect();
    return await getEnrollmentDetail(client, userId, id, today);
  } catch (error: unknown) {
    practicesError(error, "Failed to load the reading plan.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
