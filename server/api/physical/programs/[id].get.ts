import { createError, getRouterParam } from "h3";
import { createDbClient } from "../../../utils/db";
import { requirePrivateUserId } from "../../../utils/privateUserAccess";
import { getProgram, parseProgramId, programSetupError } from "../../../utils/workoutPrograms";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const programId = parseProgramId(getRouterParam(event, "id"));

  const client = createDbClient();
  try {
    await client.connect();
    const program = await getProgram(client, userId, programId);
    return { program };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    const setup = programSetupError(error);
    if (setup) throw setup;
    console.error("physical program get failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load program." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
