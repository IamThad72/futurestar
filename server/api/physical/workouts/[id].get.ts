import { createError } from "h3";
import { createDbClient } from "../../../utils/db";
import { requirePrivateUserId } from "../../../utils/privateUserAccess";
import { getWorkoutById, isMissingRelation, parseWorkoutId } from "../../../utils/workouts";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const workoutId = parseWorkoutId(getRouterParam(event, "id"));

  const client = createDbClient();
  try {
    await client.connect();
    const workout = await getWorkoutById(client, userId, workoutId);
    if (!workout) {
      throw createError({ statusCode: 404, statusMessage: "Workout not found." });
    }
    return { workout };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    if (isMissingRelation(error)) {
      throw createError({ statusCode: 500, statusMessage: "Workouts are not set up yet. Run database migrations." });
    }
    console.error("physical workout get failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load workout." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
