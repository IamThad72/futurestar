import { createError, readBody } from "h3";
import { createDbClient } from "../../../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../../../utils/privateUserAccess";
import { generateJson } from "../../../../utils/groq";
import {
  buildNutritionComparison,
  getActiveNutritionPlan,
  getDailyMacros,
  mapNutritionWriteError,
  parseEatenOn,
} from "../../../../utils/nutritionIntake";
import { addDaysIso, todayIsoDate } from "~/utils/liturgicalCalendar";
import { pickFoodsForGap } from "~/utils/mealGap.js";

type RecentFood = {
  id: number;
  name: string;
  user_food_id: number | null;
  fdc_id: number | null;
  portion_id: number | null;
  portion_label: string;
  serving_g: number;
  quantity: number;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  kcal_per_100g: number | null;
  protein_g_per_100g: number | null;
  fat_g_per_100g: number | null;
  carb_g_per_100g: number | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function per100(amount: number, grams: number): number | null {
  if (!(grams > 0) || !Number.isFinite(amount)) return null;
  return Math.round(((amount * 100) / grams) * 10) / 10;
}

function toProposal(food: RecentFood) {
  return {
    name: food.name,
    quantity: 1,
    portion_label: food.portion_label,
    serving_g: food.serving_g,
    requested_serving: null,
    fdc_id: food.fdc_id,
    user_food_id: food.user_food_id,
    portion_id: food.portion_id,
    kcal_per_100g: food.kcal_per_100g,
    protein_g_per_100g: food.protein_g_per_100g,
    fat_g_per_100g: food.fat_g_per_100g,
    carb_g_per_100g: food.carb_g_per_100g,
  };
}

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const body = omitGroupScope((await readBody(event)) as Record<string, unknown>);
  const eatenOn = parseEatenOn(body?.date || body?.eaten_on || todayIsoDate());
  const startOn = addDaysIso(eatenOn, -21);

  const client = createDbClient();
  try {
    await client.connect();
    const [macros, plan, recent] = await Promise.all([
      getDailyMacros(client, userId, eatenOn),
      getActiveNutritionPlan(client, userId),
      client.query(
        `SELECT DISTINCT ON (lower(food_name))
                entry_id, food_name, user_food_id, fdc_id, portion_id, portion_label,
                quantity, gram_weight, kcal, protein_g, fat_g, carb_g
         FROM nutrition_intake_entries
         WHERE user_id = $1
           AND eaten_on >= $2::date
           AND eaten_on <= $3::date
           AND food_name IS NOT NULL
           AND btrim(food_name) <> ''
         ORDER BY lower(food_name), eaten_on DESC, entry_id DESC
         LIMIT 30`,
        [userId, startOn, eatenOn],
      ),
    ]);
    const comparison = buildNutritionComparison(macros, plan);
    if (!comparison.remaining) {
      throw createError({ statusCode: 400, statusMessage: "Save a daily plan before asking what is left." });
    }

    const foods: RecentFood[] = [];
    recent.rows.forEach((row, index) => {
      const quantity = Number(row.quantity) || 1;
      const grams = Number(row.gram_weight);
      if (!(grams > 0) || !(quantity > 0)) return;
      const servingG = grams / quantity;
      const kcal = Number(row.kcal) / quantity;
      const protein = Number(row.protein_g) / quantity;
      const fat = Number(row.fat_g) / quantity;
      const carb = Number(row.carb_g) / quantity;
      if (!(kcal > 0)) return;
      foods.push({
        id: index + 1,
        name: String(row.food_name),
        user_food_id: row.user_food_id != null ? Number(row.user_food_id) : null,
        fdc_id: row.fdc_id != null ? Number(row.fdc_id) : null,
        portion_id: row.portion_id != null ? Number(row.portion_id) : null,
        portion_label: String(row.portion_label || "1 serving"),
        serving_g: servingG,
        quantity: 1,
        kcal,
        protein_g: protein,
        fat_g: fat,
        carb_g: carb,
        kcal_per_100g: per100(kcal, servingG),
        protein_g_per_100g: per100(protein, servingG),
        fat_g_per_100g: per100(fat, servingG),
        carb_g_per_100g: per100(carb, servingG),
      });
    });

    let chosen = pickFoodsForGap(foods, comparison.remaining);
    if (foods.length) {
      try {
        const raw = asRecord(
          await generateJson(
            [
              "Pick up to 3 foods from the list to fill the remaining calories and protein.",
              'Return {"ids":[1,2]}.',
              "ids must be copied from foods. Do not invent foods or calories.",
            ].join(" "),
            {
              remaining: comparison.remaining,
              foods: foods.map((food) => ({
                id: food.id,
                name: food.name,
                kcal: Math.round(food.kcal),
                protein_g: Math.round(food.protein_g),
              })),
            },
          ),
        );
        const ids = new Set(
          (Array.isArray(raw?.ids) ? raw.ids : [])
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && foods.some((food) => food.id === id)),
        );
        const picked = foods.filter((food) => ids.has(food.id)).slice(0, 3);
        if (picked.length) chosen = picked;
      } catch (error) {
        console.error("meal gap names failed", error);
      }
    }

    if (!chosen.length) {
      throw createError({
        statusCode: 422,
        statusMessage: "Nothing in the recent log fits what is left today.",
      });
    }
    return {
      remaining: comparison.remaining,
      items: chosen.map(toProposal),
      unmatched: [],
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("nutrition suggest failed", error);
    throw mapNutritionWriteError(error, "Could not suggest foods for what is left.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
