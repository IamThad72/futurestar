import { createError, readBody } from "h3";
import { createDbClient } from "../../../../utils/db";
import { generateJson } from "../../../../utils/groq";
import { getFdcFoodDetail, searchFdcFoods, type FdcFoodPortion } from "../../../../utils/fdcApi";
import {
  NUTRITION_MEAL_TYPES,
  mapNutritionWriteError,
  parseMealType,
  type NutritionMealType,
} from "../../../../utils/nutritionIntake";
import { omitGroupScope, requirePrivateUserId } from "../../../../utils/privateUserAccess";
import { listUserFoods, type UserFood } from "../../../../utils/userFoods";

const OZ_IN_GRAMS = 28.3495;
const MAX_ITEMS = 12;

type ParsedItem = {
  name: string;
  brand: string | null;
  serving: string | null;
  quantity: number;
  unit: string;
  meal: NutritionMealType | null;
};

type FoodProposal = {
  name: string;
  quantity: number;
  portion_label: string;
  serving_g: number;
  requested_serving: string | null;
  fdc_id: number | null;
  user_food_id: number | null;
  portion_id: number | null;
  kcal_per_100g: number | null;
  protein_g_per_100g: number | null;
  fat_g_per_100g: number | null;
  carb_g_per_100g: number | null;
};

function per100FromServing(amount: number, servingG: number): number | null {
  if (!(servingG > 0) || !Number.isFinite(amount)) return null;
  return (amount * 100) / servingG;
}

const SERVING_UNITS: Record<string, string> = {
  g: "g",
  gram: "g",
  grams: "g",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  cup: "cup",
  cups: "cup",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  serving: "serving",
  servings: "serving",
  piece: "piece",
  pieces: "piece",
  bar: "piece",
  bars: "piece",
  container: "piece",
  containers: "piece",
  packet: "piece",
  packets: "piece",
  bottle: "piece",
  bottles: "piece",
  can: "piece",
  cans: "piece",
  slice: "piece",
  slices: "piece",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function blankToNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text || text.toLowerCase() === "null" || text.toLowerCase() === "none") return null;
  return text.slice(0, 80);
}

/** Serving size written in the description, such as "5.3 oz" or "1 container". */
function parseServingPhrase(serving: string | null): { quantity: number; unit: string } | null {
  if (!serving) return null;
  const match = serving.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/);
  if (!match) return null;
  const quantity = Number(match[1]);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 50) return null;
  const unit = SERVING_UNITS[(match[2] || "serving").toLowerCase()];
  return unit ? { quantity, unit } : null;
}

function matchUserFood(foods: UserFood[], name: string, brand: string | null): UserFood | null {
  const query = normalizeName(name);
  const brandedQuery = normalizeName(brand ? `${brand} ${name}` : name);
  if (query.length < 2 && brandedQuery.length < 2) return null;
  const wantedBrand = normalizeName(brand || "");
  let best: UserFood | null = null;
  let bestScore = 0;
  for (const food of foods) {
    const candidate = normalizeName(food.name);
    const foodBrand = normalizeName(food.brand || "");
    const labeled = normalizeName(`${food.brand || ""} ${food.name}`);
    if (!candidate && !labeled) continue;
    let score = 0;
    if (candidate === query || labeled === brandedQuery) score = 100;
    else if (
      (candidate && (candidate.includes(query) || query.includes(candidate))) ||
      (labeled && (labeled.includes(brandedQuery) || brandedQuery.includes(labeled)))
    ) {
      const left = candidate || labeled;
      const right = query || brandedQuery;
      score = Math.round((Math.min(left.length, right.length) / Math.max(left.length, right.length)) * 80);
    }
    if (wantedBrand) {
      if (foodBrand && (foodBrand.includes(wantedBrand) || wantedBrand.includes(foodBrand))) score += 30;
      else if (labeled.includes(wantedBrand)) score += 20;
      else if (foodBrand) score -= 40;
    }
    if (score > bestScore) {
      bestScore = score;
      best = food;
    }
  }
  return bestScore >= 60 ? best : null;
}

function portionText(portion: FdcFoodPortion) {
  return normalizeName(`${portion.label} ${portion.measure_name || ""} ${portion.unit || ""}`);
}

function pickPortion(portions: FdcFoodPortion[], unit: string, serving: string | null): FdcFoodPortion | null {
  const usable = portions.filter((portion) => portion.gram_weight > 0);
  if (!usable.length) return null;
  const servingTokens = normalizeName(serving || "")
    .split(" ")
    .filter((token) => token.length > 3 && !/^\d/.test(token));
  if (servingTokens.length) {
    const byServing = usable.find((portion) => {
      const label = portionText(portion);
      return servingTokens.some((token) => label.includes(token));
    });
    if (byServing) return byServing;
  }
  const hint = unit.toLowerCase();
  const hinted = usable.find((portion) => {
    const label = portionText(portion);
    if (hint === "cup") return /\bcups?\b/.test(label);
    if (hint === "tbsp") return /tablespoon|\btbsp\b/.test(label);
    if (hint === "tsp") return /teaspoon|\btsp\b/.test(label);
    if (hint === "piece") return /piece|slice|item|egg|medium|large|small|bar|container|packet|serving/.test(label);
    return /serving/.test(label);
  });
  return hinted || usable.find((portion) => /serving/i.test(portion.label)) || usable[0];
}

function parseItems(raw: unknown, fallbackMeal: NutritionMealType | null): ParsedItem[] {
  const record = asRecord(raw);
  const list = Array.isArray(record?.items) ? record.items : [];
  const items: ParsedItem[] = [];
  for (const entry of list) {
    const row = asRecord(entry);
    if (!row) continue;
    const name = String(row.name || "").trim().slice(0, 80);
    const brand = blankToNull(row.brand);
    const serving = blankToNull(row.serving ?? row.serving_size);
    const fromServing = parseServingPhrase(serving);
    const quantity = fromServing?.quantity ?? Number(row.quantity);
    const unit = (fromServing?.unit || String(row.unit || "serving")).trim().toLowerCase();
    if (!name || !Number.isFinite(quantity) || quantity <= 0 || quantity > 50) continue;
    let meal: NutritionMealType | null = fallbackMeal;
    const mealRaw = String(row.meal || "").trim().toLowerCase();
    if (NUTRITION_MEAL_TYPES.includes(mealRaw as NutritionMealType)) meal = mealRaw as NutritionMealType;
    items.push({ name, brand, serving, quantity, unit, meal });
    if (items.length >= MAX_ITEMS) break;
  }
  return items;
}

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const body = omitGroupScope((await readBody(event)) as Record<string, unknown>);
  const text = String(body?.text || "").trim();
  if (text.length < 2 || text.length > 800) {
    throw createError({ statusCode: 400, statusMessage: "Describe the meal in a short sentence." });
  }
  const fallbackMeal = parseMealType(body?.meal ?? body?.meal_type);

  const parsed = parseItems(
    await generateJson(
      [
        "Split a meal description into foods. Read the brand and serving size when the person typed them.",
        'Return {"items":[{"name":"greek yogurt","brand":"Chobani","quantity":1,"unit":"oz","serving":"5.3 oz","meal":"breakfast"}]}.',
        "name is the food only. Do not put the brand in name.",
        "brand is the brand written in the text, or null when none is written. Never invent a brand.",
        "serving is the serving size written in the text, such as \"1 cup\", \"2 tbsp\", \"5.3 oz\", \"1 container\", or \"1 bar\". Use null when no serving size is written.",
        "When serving contains a number and a unit, quantity and unit must match that serving size.",
        "quantity is a number from 0 to 50.",
        "unit is one of: piece, serving, g, oz, cup, tbsp, tsp.",
        "meal is breakfast, lunch, dinner, snack, other, or null when the text does not name a meal.",
        "Include only foods, brands, and serving sizes that are in the text.",
      ].join(" "),
      { text, meal: fallbackMeal },
    ),
    fallbackMeal,
  );
  if (!parsed.length) {
    throw createError({ statusCode: 422, statusMessage: "Could not find foods in that description." });
  }

  const client = createDbClient();
  const items: FoodProposal[] = [];
  const unmatched: string[] = [];
  try {
    await client.connect();
    const foods = await listUserFoods(client, userId, "", 200);
    for (const item of parsed) {
      try {
        const custom = matchUserFood(foods, item.name, item.brand);
        const countAsServings = item.unit === "piece" || item.unit === "serving";
        if (custom && custom.serving_g > 0 && (countAsServings || item.unit === "g" || item.unit === "oz")) {
          const grams =
            item.unit === "g" ? item.quantity : item.unit === "oz" ? item.quantity * OZ_IN_GRAMS : null;
          const quantity = grams != null ? grams / custom.serving_g : item.quantity;
          if (!(quantity > 0)) {
            unmatched.push(item.name);
            continue;
          }
          items.push({
            name: custom.name,
            quantity,
            portion_label: custom.serving_label,
            serving_g: custom.serving_g,
            requested_serving: item.serving,
            fdc_id: null,
            user_food_id: custom.food_id,
            portion_id: null,
            kcal_per_100g: per100FromServing(custom.kcal, custom.serving_g),
            protein_g_per_100g: per100FromServing(custom.protein_g, custom.serving_g),
            fat_g_per_100g: per100FromServing(custom.fat_g, custom.serving_g),
            carb_g_per_100g: per100FromServing(custom.carb_g, custom.serving_g),
          });
          continue;
        }

        const searchQuery = [item.brand, item.name].filter(Boolean).join(" ");
        const search = await searchFdcFoods(searchQuery, 8);
        const wantedBrand = normalizeName(item.brand || "");
        const hit =
          (wantedBrand
            ? search.foods.find((food) => {
                const label = normalizeName(`${food.brand_name || ""} ${food.brand_owner || ""} ${food.description || ""}`);
                return Boolean(food.fdc_id) && label.includes(wantedBrand);
              })
            : null) ||
          search.foods.find((food) => food.fdc_id) ||
          null;
        const detail = hit?.fdc_id ? await getFdcFoodDetail(hit.fdc_id) : null;
        if (!detail) {
          unmatched.push(item.name);
          continue;
        }
        const portion = item.unit === "g" || item.unit === "oz" ? null : pickPortion(detail.portions, item.unit, item.serving);
        const gramWeight =
          item.unit === "g"
            ? item.quantity
            : item.unit === "oz"
              ? item.quantity * OZ_IN_GRAMS
              : portion
                ? portion.gram_weight * item.quantity
                : null;
        if (gramWeight == null || gramWeight <= 0) {
          unmatched.push(item.name);
          continue;
        }
        const quantity = item.unit === "g" || item.unit === "oz" ? 1 : item.quantity;
        items.push({
          name: detail.description,
          quantity,
          portion_label: portion?.label || item.serving || `${Math.round(gramWeight)} g`,
          serving_g: gramWeight / quantity,
          requested_serving: item.serving,
          fdc_id: detail.fdc_id,
          user_food_id: null,
          portion_id: portion?.portion_id ?? null,
          kcal_per_100g: detail.kcal_per_100g,
          protein_g_per_100g: detail.protein_g_per_100g,
          fat_g_per_100g: detail.fat_g_per_100g,
          carb_g_per_100g: detail.carb_g_per_100g,
        });
      } catch (error) {
        if (error && typeof error === "object" && "statusCode" in error) {
          const status = Number((error as { statusCode?: number }).statusCode);
          if (status >= 500) throw error;
        }
        unmatched.push(item.name);
      }
    }
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("nutrition describe failed", error);
    throw mapNutritionWriteError(error, "Failed to read that meal.");
  } finally {
    await client.end().catch(() => undefined);
  }

  if (!items.length) {
    throw createError({
      statusCode: 422,
      statusMessage: "Could not match those foods. Add them as saved foods, or try a simpler name.",
    });
  }

  return { items, unmatched };
});
