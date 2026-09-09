import { readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import { mapNutritionWriteError } from "../../../utils/nutritionIntake";
import { createUserFood, parseUserFoodInput, userFoodToDetail, userFoodToSearchHit } from "../../../utils/userFoods";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const body = omitGroupScope((await readBody(event)) as Record<string, unknown>);
  const input = parseUserFoodInput(body || {});

  const client = createDbClient();
  try {
    await client.connect();
    const food = await createUserFood(client, userId, input);
    const detail = userFoodToDetail(food);
    return {
      food: {
        ...userFoodToSearchHit(food),
        portions: detail.portions,
      },
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("physical nutrition user-foods create failed", error);
    throw mapNutritionWriteError(error, "Failed to save custom food.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
