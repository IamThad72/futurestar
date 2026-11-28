import { getRouterParam } from "h3";
import { createDbClient } from "../../../utils/db";
import { requirePrivateUserId } from "../../../utils/privateUserAccess";
import { deleteProgram, parseProgramId, programSetupError } from "../../../utils/workoutPrograms";
import { mapWorkoutWriteError } from "../../../utils/workouts";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const programId = parseProgramId(getRouterParam(event, "id"));

  const client = createDbClient();
  try {
    await client.connect();
    await deleteProgram(client, userId, programId);
    return { success: true };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    const setup = programSetupError(error);
    if (setup) throw setup;
    console.error("physical program delete failed", error);
    throw mapWorkoutWriteError(error, "Failed to delete program.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
