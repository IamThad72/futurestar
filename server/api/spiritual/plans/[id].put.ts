import { getRouterParam, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import { clientToday, parseId, practicesError } from "../../../utils/faithPractices";
import { getEnrollmentDetail, updatePlan } from "../../../utils/readingPlans";

/** { action: "skip_missed" | "reschedule" | "stop" | "resume" | "restart", date? } */
export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const id = parseId(getRouterParam(event, "id"), "plan");
  const body = omitGroupScope((await readBody(event)) as Record<string, unknown>);
  const today = clientToday(event, body.date);
  const client = createDbClient();
  try {
    await client.connect();
    await updatePlan(client, userId, id, String(body.action || ""), today);
    return await getEnrollmentDetail(client, userId, id, today);
  } catch (error: unknown) {
    practicesError(error, "Failed to update the reading plan.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
