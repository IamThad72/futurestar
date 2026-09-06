import { createError, getQuery } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import { isMissingRelation, listWorkouts } from "../../../utils/workouts";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  omitGroupScope(getQuery(event) as Record<string, unknown>);

  const client = createDbClient();
  try {
    await client.connect();
    const workouts = await listWorkouts(client, userId);
    return { workouts };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    if (isMissingRelation(error)) {
      throw createError({ statusCode: 500, statusMessage: "Workouts are not set up yet. Run database migrations." });
    }
    console.error("physical workouts list failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load workouts." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
