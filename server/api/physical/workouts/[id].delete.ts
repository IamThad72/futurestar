import { createDbClient } from "../../../utils/db";
import { requirePrivateUserId } from "../../../utils/privateUserAccess";
import { deleteWorkout, mapWorkoutWriteError, parseWorkoutId } from "../../../utils/workouts";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const workoutId = parseWorkoutId(getRouterParam(event, "id"));

  const client = createDbClient();
  try {
    await client.connect();
    await deleteWorkout(client, userId, workoutId);
    return { success: true };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("physical workout delete failed", error);
    throw mapWorkoutWriteError(error, "Failed to delete workout.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
