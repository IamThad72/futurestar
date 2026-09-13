import { readBody } from "h3";
import { createDbClient } from "../../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../../utils/privateUserAccess";
import { mapNutritionWriteError } from "../../../../utils/nutritionIntake";
import {
  parseUserFoodId,
  parseUserFoodInput,
  updateUserFood,
  userFoodToDetail,
  userFoodToSearchHit,
} from "../../../../utils/userFoods";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const foodId = parseUserFoodId(getRouterParam(event, "id"));
  const body = omitGroupScope((await readBody(event)) as Record<string, unknown>);
  const input = parseUserFoodInput(body || {});

  const client = createDbClient();
  try {
    await client.connect();
    const food = await updateUserFood(client, userId, foodId, input);
    const detail = userFoodToDetail(food);
    return {
      food: {
        ...userFoodToSearchHit(food),
        portions: detail.portions,
      },
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("physical nutrition user-foods update failed", error);
    throw mapNutritionWriteError(error, "Failed to update food.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
