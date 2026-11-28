import { getRouterParam, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import { parseProgramId, programSetupError, updateProgram } from "../../../utils/workoutPrograms";
import { mapWorkoutWriteError } from "../../../utils/workouts";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const programId = parseProgramId(getRouterParam(event, "id"));
  const body = omitGroupScope((await readBody(event)) as Record<string, unknown>);

  const client = createDbClient();
  try {
    await client.connect();
    const program = await updateProgram(client, userId, programId, {
      name: body.name,
      description: body.description,
      sortOrder: body.sortOrder,
    });
    return { program };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    const setup = programSetupError(error);
    if (setup) throw setup;
    console.error("physical program update failed", error);
    throw mapWorkoutWriteError(error, "Failed to save program.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
