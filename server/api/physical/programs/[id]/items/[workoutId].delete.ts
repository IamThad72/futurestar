import { getRouterParam } from "h3";
import { createDbClient } from "../../../../../utils/db";
import { requirePrivateUserId } from "../../../../../utils/privateUserAccess";
import { parseProgramId, programSetupError, removeProgramItem } from "../../../../../utils/workoutPrograms";
import { mapWorkoutWriteError, parseWorkoutId } from "../../../../../utils/workouts";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const programId = parseProgramId(getRouterParam(event, "id"));
  const workoutId = parseWorkoutId(getRouterParam(event, "workoutId"));

  const client = createDbClient();
  try {
    await client.connect();
    await removeProgramItem(client, userId, programId, workoutId);
    return { success: true };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    const setup = programSetupError(error);
    if (setup) throw setup;
    console.error("physical program item remove failed", error);
    throw mapWorkoutWriteError(error, "Failed to remove the workout from the program.");
  } finally {
    await client.end().catch(() => undefined);
  }
});