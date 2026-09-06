import { createError, getQuery } from "h3";
import { FDC_MISSING_KEY_MESSAGE, hasFdcApiKey } from "../../../utils/fdcApi";
import { omitGroupScope, requirePrivateUserId } from "../../../utils/privateUserAccess";
import { getNutritionFoodDetail, searchNutritionFoods } from "../../../utils/nutritionIntake";

export default defineEventHandler(async (event) => {
  await requirePrivateUserId(event);
  const query = omitGroupScope(getQuery(event) as Record<string, unknown>);
  const fdcRaw = query.fdc_id != null ? parseInt(String(query.fdc_id), 10) : NaN;
  const q = String(query.q || "").trim();
  const limitRaw = query.limit != null ? parseInt(String(query.limit), 10) : 25;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 25;

  try {
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
    return await searchNutritionFoods(q, limit);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("physical nutrition foods failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to search foods." });
  }
});
