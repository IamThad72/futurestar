import { createError, getQuery } from "h3";
import { createDbClient } from "../../../utils/db";
import { FDC_MISSING_KEY_MESSAGE, hasFdcApiKey } from "../../../utils/fdcApi";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import { getNutritionFoodDetail, mapNutritionWriteError, searchNutritionFoods } from "../../../utils/nutritionIntake";
import { getUserFood, listUserFoods, userFoodToDetail, userFoodToSearchHit } from "../../../utils/userFoods";

function foodDetailPayload(detail: ReturnType<typeof userFoodToDetail>) {
  const nutrients = [
    { nutrient_id: 1008, name: "Energy", unit_name: "kcal", rank: 300, amount: detail.kcal_per_100g },
    { nutrient_id: 1003, name: "Protein", unit_name: "g", rank: 600, amount: detail.protein_g_per_100g },
    { nutrient_id: 1004, name: "Total lipid (fat)", unit_name: "g", rank: 800, amount: detail.fat_g_per_100g },
    { nutrient_id: 1005, name: "Carbohydrate, by difference", unit_name: "g", rank: 1110, amount: detail.carb_g_per_100g },
  ].filter((n) => n.amount != null);

  return {
    ...detail,
    fdc_id: null,
    user_food_id: detail.portions[0]?.portion_id ?? null,
    source: "custom" as const,
    serving_g: detail.portions[0]?.gram_weight ?? null,
    serving_label: detail.portions[0]?.label ?? null,
    nutrients,
  };
}

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const query = omitGroupScope(getQuery(event) as Record<string, unknown>);
  const fdcRaw = query.fdc_id != null ? parseInt(String(query.fdc_id), 10) : NaN;
  const userFoodRaw = query.user_food_id != null ? parseInt(String(query.user_food_id), 10) : NaN;
  const q = String(query.q || "").trim();
  const limitRaw = query.limit != null ? parseInt(String(query.limit), 10) : 25;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 25;

  const client = createDbClient();
  try {
    await client.connect();

    if (Number.isInteger(userFoodRaw) && userFoodRaw > 0) {
      const food = await getUserFood(client, userId, userFoodRaw);
      if (!food) {
        throw createError({ statusCode: 404, statusMessage: "Custom food not found." });
      }
      return { food: foodDetailPayload(userFoodToDetail(food)) };
    }

    if (Number.isInteger(fdcRaw) && fdcRaw > 0) {
      if (!hasFdcApiKey()) {
        throw createError({ statusCode: 503, statusMessage: FDC_MISSING_KEY_MESSAGE });
      }
      const food = await getNutritionFoodDetail(fdcRaw);
      if (!food) {
        throw createError({ statusCode: 404, statusMessage: "Food not found." });
      }
      return { food };
    }

    const custom = await listUserFoods(client, userId, q, Math.min(limit, 15));
    const customHits = custom.map(userFoodToSearchHit);
    if (q.length < 2) {
      return { foods: customHits, fdc_search: { enabled: hasFdcApiKey(), queried: false, message: null } };
    }

    const fdc = await searchNutritionFoods(q, limit);
    return {
      foods: [...customHits, ...fdc.foods].slice(0, limit + customHits.length),
      fdc_search: fdc.fdc_search,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("physical nutrition foods failed", error);
    throw mapNutritionWriteError(error, "Failed to search foods.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
