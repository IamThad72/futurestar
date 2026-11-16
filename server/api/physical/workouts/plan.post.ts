import { createError, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { requirePrivateUserId } from "../../../utils/privateUserAccess";
import { generateWorkoutPlan } from "../../../utils/workoutPlan";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const body = await readBody(event);
  const client = createDbClient();
  try {
    await client.connect();
    return await generateWorkoutPlan(client, userId, body);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("workout plan generate failed", error);
    throw createError({ statusCode: 500, statusMessage: "Could not generate a workout plan." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
