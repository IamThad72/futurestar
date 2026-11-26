import { getRouterParam, readBody } from "h3";
import { createDbClient } from "../../../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../../../utils/privateUserAccess";
import { clientToday, parseId, practicesError } from "../../../../../utils/faithPractices";
import { getEnrollmentDetail, markDay } from "../../../../../utils/readingPlans";

/** { status: "done" | "skipped" | "clear", date? } */
export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const id = parseId(getRouterParam(event, "id"), "plan");
  const day = parseId(getRouterParam(event, "day"), "day");
  const body = omitGroupScope((await readBody(event)) as Record<string, unknown>);
  const today = clientToday(event, body.date);
  const client = createDbClient();
  try {
    await client.connect();
    await markDay(client, userId, id, day, String(body.status || ""), today);
    return await getEnrollmentDetail(client, userId, id, today);
  } catch (error: unknown) {
    practicesError(error, "Failed to save the reading.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
