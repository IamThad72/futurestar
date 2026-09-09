/**
 * USDA FoodData Central (FDC) client for nutrition search and food detail.
 * Foundation and Branded foods are fetched live. Nothing is stored in a local catalog.
 */

import { formatPortionDropdownLabel } from "~/utils/foodPortionLabel";

export const FDC_API_BASE = "https://api.nal.usda.gov/fdc/v1";
export const FDC_SEARCH_PAGE_SIZE = 25;
export const FDC_MISSING_KEY_MESSAGE =
  "Nutrition search needs an FDC API key (FDC_API_KEY or USDA_FDC_API_KEY).";
export const FDC_RATE_LIMIT_MESSAGE = "USDA FoodData Central is temporarily rate-limited. Try again shortly.";
export const FDC_UNAVAILABLE_MESSAGE = "Could not reach USDA FoodData Central. Try again shortly.";

const SEARCH_CACHE_TTL_MS = 3 * 60 * 1000;
const FOOD_CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 80;
const FETCH_TIMEOUT_MS = 10_000;

const NUTRIENT_KCAL = 1008;
const NUTRIENT_PROTEIN = 1003;
const NUTRIENT_FAT = 1004;
const NUTRIENT_CARB = 1005;
const NUTRIENT_KCAL_FALLBACKS = [2048, 2047];

const MASS_G = new Set(["g", "gr", "gram", "grams"]);
const MASS_ML = new Set(["ml", "milliliter", "milliliters", "millilitre", "millilitres"]);

export type FdcSearchStatus = {
  enabled: boolean;
  queried: boolean;
  message: string | null;
};

export type NutritionFoodSearchHit = {
  fdc_id: number | null;
  user_food_id?: number | null;
  description: string;
  category: string | null;
  data_type: string;
  kcal_per_100g: number | null;
  protein_g_per_100g: number | null;
  fat_g_per_100g: number | null;
  carb_g_per_100g: number | null;
  serving_g?: number | null;
  serving_label?: string | null;
  is_branded: boolean;
  brand_owner: string | null;
  brand_name: string | null;
  source: "fdc" | "custom";
};

export type FdcFoodPortion = {
  portion_id: number;
  amount: number | null;
  unit: string | null;
  measure_name: string | null;
  gram_weight: number;
  label: string;
};

export type FdcFoodDetail = {
  fdc_id: number;
  description: string;
  data_type: string;
  category: string | null;
  brand_owner: string | null;
  brand_name: string | null;
  is_branded: boolean;
  kcal_per_100g: number | null;
  protein_g_per_100g: number | null;
  fat_g_per_100g: number | null;
  carb_g_per_100g: number | null;
  portions: FdcFoodPortion[];
};

type CacheEntry<T> = { expires: number; value: T };

const searchCache = new Map<string, CacheEntry<NutritionFoodSearchHit[]>>();
const foodCache = new Map<string, CacheEntry<FdcFoodDetail>>();
const searchInflight = new Map<string, Promise<NutritionFoodSearchHit[]>>();
const foodInflight = new Map<string, Promise<FdcFoodDetail | null>>();

export function getFdcApiKey(): string {
  let runtimeKey = "";
  try {
    runtimeKey = String(useRuntimeConfig().fdcApiKey || "").trim();
  } catch {
    runtimeKey = "";
  }
  return String(
    process.env.FDC_API_KEY ||
      process.env.USDA_FDC_API_KEY ||
      process.env.NUXT_FDC_API_KEY ||
      runtimeKey ||
      "",
  ).trim();
}

export function hasFdcApiKey() {
  return Boolean(getFdcApiKey());
}

/** USDA food_portion ids are positive. Negative ids are reserved for branded labeled servings. */
export function brandedPortionId(fdcId: number) {
  return -Math.abs(fdcId);
}

function asFinite(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function isBrandedDataType(dataType: unknown) {
  return String(dataType || "").trim().toLowerCase() === "branded";
}

function cacheGet<T>(map: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const hit = map.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    map.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet<T>(map: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
  if (map.size >= CACHE_MAX) {
    const first = map.keys().next().value;
    if (first != null) map.delete(first);
  }
  map.set(key, { expires: Date.now() + ttlMs, value });
}

/**
 * Branded nutrient amounts are typically per labeled serving.
 * Convert to per 100 g: amount * 100 / serving_g.
 * Foundation nutrients are already per 100 g (servingG = 100 is a no-op).
 */
export function brandedServingGrams(servingSize: unknown, servingSizeUnit: unknown): number {
  const size = asFinite(servingSize);
  const unit = String(servingSizeUnit || "").trim().toLowerCase();
  if (size == null || size <= 0) return 100;
  if (!unit || MASS_G.has(unit)) return size;
  if (MASS_ML.has(unit)) return size;
  if (unit === "kg" || unit === "kilogram" || unit === "kilograms") return size * 1000;
  if (unit === "oz" || unit === "ounce" || unit === "ounces") return size * 28.3495;
  if (unit === "lb" || unit === "pound" || unit === "pounds") return size * 453.592;
  return size;
}

export function amountPer100g(amount: number | null, servingG: number): number | null {
  if (amount == null || !(servingG > 0)) return amount;
  return (amount * 100) / servingG;
}

export function scaleMacrosToGrams(
  per100: {
    kcal: number | null;
    protein_g: number | null;
    fat_g: number | null;
    carb_g: number | null;
  },
  gramWeight: number,
) {
  const factor = gramWeight / 100;
  const scale = (value: number | null) => (value == null ? null : value * factor);
  return {
    kcal: scale(per100.kcal),
    protein_g: scale(per100.protein_g),
    fat_g: scale(per100.fat_g),
    carb_g: scale(per100.carb_g),
  };
}

function nutrientId(row: Record<string, unknown>): number | null {
  const nested = row.nutrient && typeof row.nutrient === "object" ? (row.nutrient as Record<string, unknown>) : null;
  return asFinite(row.nutrientId) ?? asFinite(nested?.id);
}

function nutrientUnit(row: Record<string, unknown>): string {
  const nested = row.nutrient && typeof row.nutrient === "object" ? (row.nutrient as Record<string, unknown>) : null;
  return String(row.unitName || nested?.unitName || "").trim().toLowerCase();
}

function nutrientAmount(row: Record<string, unknown>): number | null {
  return asFinite(row.amount) ?? asFinite(row.value);
}

function pickNutrient(foodNutrients: unknown, ids: number[], kcalOnly = false): number | null {
  if (!Array.isArray(foodNutrients)) return null;
  for (const id of ids) {
    for (const raw of foodNutrients) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      if (nutrientId(row) !== id) continue;
      if (kcalOnly) {
        const unit = nutrientUnit(row);
        if (unit === "kj" || unit === "kilojoule" || unit === "kilojoules") continue;
      }
      const amount = nutrientAmount(row);
      if (amount != null) return amount;
    }
  }
  return null;
}

function servingGramsForMacros(food: Record<string, unknown>): number {
  if (isBrandedDataType(food.dataType ?? food.data_type)) {
    return brandedServingGrams(food.servingSize, food.servingSizeUnit);
  }
  return 100;
}

function macrosFromNutrients(foodNutrients: unknown, servingG: number) {
  const kcal = pickNutrient(foodNutrients, [NUTRIENT_KCAL, ...NUTRIENT_KCAL_FALLBACKS], true);
  const protein = pickNutrient(foodNutrients, [NUTRIENT_PROTEIN]);
  const fat = pickNutrient(foodNutrients, [NUTRIENT_FAT]);
  const carb = pickNutrient(foodNutrients, [NUTRIENT_CARB]);
  return {
    kcal: amountPer100g(kcal, servingG),
    protein_g: amountPer100g(protein, servingG),
    fat_g: amountPer100g(fat, servingG),
    carb_g: amountPer100g(carb, servingG),
  };
}

function portionUnitLabel(unitName: unknown, modifier: unknown, description: unknown): string | null {
  const unit = String(unitName || "").trim();
  const extra = String(modifier || description || "").trim();
  if (unit && extra && extra.toLowerCase() !== unit.toLowerCase()) {
    return `${unit} (${extra})`;
  }
  return unit || extra || null;
}

function brandedHouseholdLabel(food: Record<string, unknown>, servingG: number): string {
  const household = String(food.householdServingFullText || "").trim();
  if (household) return household;
  const size = asFinite(food.servingSize);
  const unit = String(food.servingSizeUnit || "").trim();
  if (size != null && unit) return `${size} ${unit}`;
  if (size != null) return `${size} serving`;
  if (servingG > 0 && servingG !== 100) return `${Math.round(servingG * 10) / 10} g`;
  return "labeled serving";
}

function withPortionLabel(mapped: {
  portion_id: number;
  amount: number | null;
  unit: string | null;
  measure_name: string | null;
  gram_weight: number;
}): FdcFoodPortion {
  return {
    ...mapped,
    label: formatPortionDropdownLabel(mapped),
  };
}

function brandedPortion(fdcId: number, food: Record<string, unknown>, servingG: number): FdcFoodPortion {
  const unit = brandedHouseholdLabel(food, servingG);
  return withPortionLabel({
    portion_id: brandedPortionId(fdcId),
    amount: null,
    unit,
    measure_name: unit,
    gram_weight: servingG,
  });
}

function mapFoodPortions(fdcId: number, food: Record<string, unknown>): FdcFoodPortion[] {
  const portions: FdcFoodPortion[] = [];
  const seen = new Set<number>();
  const rawPortions = Array.isArray(food.foodPortions) ? food.foodPortions : [];
  for (const raw of rawPortions) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const gramWeight = asFinite(row.gramWeight ?? row.gram_weight);
    if (gramWeight == null || gramWeight <= 0) continue;
    const measureUnit =
      row.measureUnit && typeof row.measureUnit === "object"
        ? (row.measureUnit as Record<string, unknown>)
        : null;
    const unit = portionUnitLabel(
      measureUnit?.name ?? row.measureUnitName,
      row.modifier,
      row.portionDescription ?? row.portion_description,
    );
    const portionId = asFinite(row.id ?? row.portionId);
    const id = portionId != null && portionId !== 0 ? portionId : brandedPortionId(fdcId) - portions.length - 1;
    if (seen.has(id)) continue;
    seen.add(id);
    portions.push(
      withPortionLabel({
        portion_id: id,
        amount: asFinite(row.amount),
        unit,
        measure_name: unit,
        gram_weight: gramWeight,
      }),
    );
  }

  if (isBrandedDataType(food.dataType ?? food.data_type)) {
    const servingG = brandedServingGrams(food.servingSize, food.servingSizeUnit);
    const labeled = brandedPortion(fdcId, food, servingG);
    const alreadyListed = portions.some(
      (portion) => Math.abs(portion.gram_weight - labeled.gram_weight) < 0.05,
    );
    if (!alreadyListed) portions.unshift(labeled);
  }

  return portions.sort((a, b) => {
    const aHousehold = isHouseholdPortion(a.measure_name) ? 0 : 1;
    const bHousehold = isHouseholdPortion(b.measure_name) ? 0 : 1;
    if (aHousehold !== bHousehold) return aHousehold - bHousehold;
    return a.portion_id - b.portion_id;
  });
}

function isHouseholdPortion(unit: string | null) {
  const value = String(unit || "").trim().toLowerCase();
  return Boolean(value) && value !== "racc" && value !== "undetermined";
}

function categoryFromFood(raw: Record<string, unknown>, brandOwner: string | null): string | null {
  const nested =
    raw.foodCategory && typeof raw.foodCategory === "object" && !Array.isArray(raw.foodCategory)
      ? (raw.foodCategory as Record<string, unknown>)
      : null;
  const fromString = typeof raw.foodCategory === "string" ? raw.foodCategory : "";
  return (
    String(raw.brandedFoodCategory || nested?.description || fromString || brandOwner || "").trim() || null
  );
}

export function mapFdcSearchHit(raw: Record<string, unknown>): NutritionFoodSearchHit | null {
  const fdcId = asFinite(raw.fdcId ?? raw.fdc_id);
  if (fdcId == null || fdcId <= 0) return null;
  const dataType = String(raw.dataType || raw.data_type || "Foundation");
  const branded = isBrandedDataType(dataType);
  const servingG = branded ? brandedServingGrams(raw.servingSize, raw.servingSizeUnit) : 100;
  const macros = macrosFromNutrients(raw.foodNutrients, servingG);
  const brandOwner = String(raw.brandOwner || "").trim() || null;
  const brandName = String(raw.brandName || "").trim() || null;
  return {
    fdc_id: fdcId,
    description: String(raw.description || "").trim() || (branded ? "Branded food" : "Food"),
    category: categoryFromFood(raw, brandOwner),
    data_type: dataType,
    kcal_per_100g: macros.kcal,
    protein_g_per_100g: macros.protein_g,
    fat_g_per_100g: macros.fat_g,
    carb_g_per_100g: macros.carb_g,
    is_branded: branded,
    brand_owner: brandOwner,
    brand_name: brandName,
    source: "fdc",
  };
}

export function mapFdcFoodDetail(raw: Record<string, unknown>): FdcFoodDetail | null {
  const fdcId = asFinite(raw.fdcId ?? raw.fdc_id);
  if (fdcId == null || fdcId <= 0) return null;
  const dataType = String(raw.dataType || raw.data_type || "Foundation");
  const branded = isBrandedDataType(dataType);
  const servingG = servingGramsForMacros(raw);
  const macros = macrosFromNutrients(raw.foodNutrients, servingG);
  const brandOwner = String(raw.brandOwner || "").trim() || null;
  const brandName = String(raw.brandName || "").trim() || null;
  return {
    fdc_id: fdcId,
    description: String(raw.description || "").trim() || (branded ? "Branded food" : "Food"),
    data_type: dataType,
    category: categoryFromFood(raw, brandOwner),
    brand_owner: brandOwner,
    brand_name: brandName,
    is_branded: branded,
    kcal_per_100g: macros.kcal,
    protein_g_per_100g: macros.protein_g,
    fat_g_per_100g: macros.fat_g,
    carb_g_per_100g: macros.carb_g,
    portions: mapFoodPortions(fdcId, raw),
  };
}

function errorCodeFrom(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: string }).code || "fdc_http");
  }
  return "fdc_http";
}

async function fdcRequest(path: string, opts?: { params?: Record<string, string>; json?: unknown }): Promise<unknown> {
  const apiKey = getFdcApiKey();
  if (!apiKey) {
    const err = new Error("missing_key");
    (err as { code?: string }).code = "missing_key";
    throw err;
  }
  const url = new URL(`${FDC_API_BASE}${path}`);
  for (const [key, value] of Object.entries(opts?.params || {})) url.searchParams.set(key, value);
  url.searchParams.set("api_key", apiKey);
  const init: RequestInit = {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  };
  if (opts?.json !== undefined) {
    init.method = "POST";
    init.headers = { Accept: "application/json", "Content-Type": "application/json" };
    init.body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, init);
  if (res.status === 429) {
    const err = new Error("rate_limit");
    (err as { code?: string }).code = "rate_limit";
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`fdc_http_${res.status}`);
    (err as { code?: string }).code = "fdc_http";
    throw err;
  }
  return res.json();
}

export function fdcSearchStatus(query: string, errorCode?: string | null): FdcSearchStatus {
  const enabled = hasFdcApiKey();
  const q = query.trim();
  if (!enabled) {
    return {
      enabled: false,
      queried: false,
      message: q ? FDC_MISSING_KEY_MESSAGE : null,
    };
  }
  if (!q) return { enabled: true, queried: false, message: null };
  if (errorCode === "rate_limit") {
    return { enabled: true, queried: true, message: FDC_RATE_LIMIT_MESSAGE };
  }
  if (errorCode) {
    return { enabled: true, queried: true, message: FDC_UNAVAILABLE_MESSAGE };
  }
  return { enabled: true, queried: true, message: null };
}

export async function searchFdcFoods(
  query: string,
  limit = FDC_SEARCH_PAGE_SIZE,
): Promise<{
  foods: NutritionFoodSearchHit[];
  errorCode: string | null;
}> {
  const q = query.trim();
  if (q.length < 2) return { foods: [], errorCode: null };
  if (!hasFdcApiKey()) return { foods: [], errorCode: "missing_key" };

  const pageSize = Math.min(Math.max(limit, 1), 50);
  const cacheKey = `${q.toLowerCase()}|${pageSize}`;
  const cached = cacheGet(searchCache, cacheKey);
  if (cached) return { foods: cached, errorCode: null };

  const pending = searchInflight.get(cacheKey);
  if (pending) {
    try {
      return { foods: await pending, errorCode: null };
    } catch (error) {
      return { foods: [], errorCode: errorCodeFrom(error) };
    }
  }

  const request = (async () => {
    const payload = (await fdcRequest("/foods/search", {
      json: {
        query: q,
        dataType: ["Foundation", "Branded"],
        pageSize,
      },
    })) as { foods?: Record<string, unknown>[] };
    const foods = (payload.foods || [])
      .map((row) => mapFdcSearchHit(row))
      .filter((row): row is NutritionFoodSearchHit => Boolean(row));
    cacheSet(searchCache, cacheKey, foods, SEARCH_CACHE_TTL_MS);
    return foods;
  })();

  searchInflight.set(cacheKey, request);
  try {
    return { foods: await request, errorCode: null };
  } catch (error) {
    return { foods: [], errorCode: errorCodeFrom(error) };
  } finally {
    searchInflight.delete(cacheKey);
  }
}

export async function getFdcFoodDetail(fdcId: number): Promise<FdcFoodDetail | null> {
  if (!Number.isInteger(fdcId) || fdcId <= 0 || !hasFdcApiKey()) return null;

  const cacheKey = String(fdcId);
  const cached = cacheGet(foodCache, cacheKey);
  if (cached) return cached;

  const pending = foodInflight.get(cacheKey);
  if (pending) return pending;

  const request = (async () => {
    const payload = (await fdcRequest(`/food/${fdcId}`, {})) as Record<string, unknown>;
    const detail = mapFdcFoodDetail(payload);
    if (detail) cacheSet(foodCache, cacheKey, detail, FOOD_CACHE_TTL_MS);
    return detail;
  })();

  foodInflight.set(cacheKey, request);
  try {
    return await request;
  } catch {
    return null;
  } finally {
    foodInflight.delete(cacheKey);
  }
}
