import { readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import { readFaithProfile } from "../../../utils/faithProfile";
import { clientToday, practicesError } from "../../../utils/faithPractices";
import { getEnrollmentDetail, startPlan } from "../../../utils/readingPlans";

/** Start a plan: { plan_key, start_on?, date? } */
export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const body = omitGroupScope((await readBody(event)) as Record<string, unknown>);
  const today = clientToday(event, body.date);
  const client = createDbClient();
  try {
    await client.connect();
    const { profile } = await readFaithProfile(client, userId);
    const id = await startPlan(client, userId, profile, body, today);
    return await getEnrollmentDetail(client, userId, id, today);
  } catch (error: unknown) {
    practicesError(error, "Failed to start the reading plan.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
