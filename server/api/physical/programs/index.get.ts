import { createError, getQuery } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import { listPrograms, programSetupError } from "../../../utils/workoutPrograms";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  omitGroupScope(getQuery(event) as Record<string, unknown>);

  const client = createDbClient();
  try {
    await client.connect();
    return await listPrograms(client, userId);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    const setup = programSetupError(error);
    if (setup) throw setup;
    console.error("physical programs list failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load programs." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
