import { createError } from "h3";
import type { Client } from "pg";
import { householdPortionLabel } from "~/utils/foodPortionLabel";
import {
  fdcSearchStatus,
  getFdcFoodDetail,
  scaleMacrosToGrams,
  searchFdcFoods,
  type FdcFoodDetail,
  type FdcSearchStatus,
  type NutritionFoodSearchHit,
} from "./fdcApi";
import { privateUserClause, privateUserClauseAt } from "./privateUserAccess";

/**
 * Physical nutrition helpers.
 * Food search/detail is USDA FoodData Central (live API). Plans, intake rows, and
 * daily totals are always scoped to `app_users.user_id` — never `group_id`.
 * Linked accounts do not share nutrition.
 */

export const NUTRITION_MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "other"] as const;
export type NutritionMealType = (typeof NUTRITION_MEAL_TYPES)[number];

export type NutritionIntakeEntry = {
  entry_id: number;
  user_id: number;
  eaten_on: string;
  eaten_at: string;
  meal: string | null;
  meal_type: string | null;
  fdc_id: number | null;
  portion_id: number | null;
  quantity: number;
  gram_weight: number | null;
  created_at: string;
  food_name?: string | null;
  food_description?: string | null;
  portion_label?: string | null;
  kcal?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  carb_g?: number | null;
};

export type NutritionDailyMacros = {
  user_id?: number;
  eaten_on?: string;
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carb_g: number | null;
};

export type NutritionPlan = {
  plan_id: number;
  user_id: number;
  name: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  created_at: string;
  updated_at: string;
};

export type NutritionPlanInput = {
  name: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
};

export type NutritionIntakeInput = {
  eaten_on: string;
  eaten_at: Date;
  meal: NutritionMealType | null;
  fdc_id: number | null;
  portion_id: number | null;
  quantity: number;
  gram_weight: number | null;
  food_name: string | null;
  portion_label: string | null;
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carb_g: number | null;
  kcal_per_100g: number | null;
  protein_g_per_100g: number | null;
  fat_g_per_100g: number | null;
  carb_g_per_100g: number | null;
};

export type NutritionMacroTotals = {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
};

export type NutritionComparison = {
  consumed: NutritionMacroTotals;
  targets: NutritionMacroTotals | null;
  remaining: NutritionMacroTotals | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function asFiniteNumber(value: unknown, fallback = 0): number {
  if (value == null || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function asNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseEatenOn(value: unknown): string {
  const eatenOn = String(value || "").trim();
  if (!DATE_RE.test(eatenOn)) {
    throw createError({ statusCode: 400, statusMessage: "date (YYYY-MM-DD) is required." });
  }
  return eatenOn;
}

/** Calendar-date arithmetic that does not depend on the server timezone. */
export function addCalendarDays(iso: string, delta: number): string {
  const eatenOn = parseEatenOn(iso);
  const [year, month, day] = eatenOn.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function parseHistoryDays(value: unknown, fallback = 7): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 31) {
    throw createError({ statusCode: 400, statusMessage: "days must be an integer from 1 to 31." });
  }
  return n;
}

export function enumerateIsoDatesInclusive(startOn: string, endOn: string): string[] {
  const start = parseEatenOn(startOn);
  const end = parseEatenOn(endOn);
  if (start > end) return [];
  const days: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addCalendarDays(cursor, 1)) {
    days.push(cursor);
    if (days.length > 31) break;
  }
  return days;
}

export function parseEatenAt(value: unknown): Date {
  if (value == null || value === "") return new Date();
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw createError({ statusCode: 400, statusMessage: "eaten_at must be a valid date-time." });
    }
    return value;
  }
  const parsed = new Date(String(value).trim());
  if (Number.isNaN(parsed.getTime())) {
    throw createError({ statusCode: 400, statusMessage: "eaten_at must be a valid date-time." });
  }
  return parsed;
}

function asIsoTimestamp(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
  }
  const parsed = new Date(String(value ?? ""));
  return Number.isNaN(parsed.getTime()) ? String(value ?? "") : parsed.toISOString();
}

export function parseMealType(value: unknown): NutritionMealType | null {
  if (value == null || value === "") return null;
  const meal = String(value).trim().toLowerCase();
  if (!NUTRITION_MEAL_TYPES.includes(meal as NutritionMealType)) {
    throw createError({
      statusCode: 400,
      statusMessage: "meal must be breakfast, lunch, dinner, snack, or other.",
    });
  }
  return meal as NutritionMealType;
}

function parseRequiredTarget(value: unknown, label: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw createError({ statusCode: 400, statusMessage: `${label} must be a number 0 or greater.` });
  }
  return n;
}

export function parsePlanInput(body: Record<string, unknown>): NutritionPlanInput {
  const name = String(body.name ?? "Daily plan").trim() || "Daily plan";
  if (name.length > 80) {
    throw createError({ statusCode: 400, statusMessage: "Plan name must be 80 characters or fewer." });
  }
  return {
    name,
    kcal: parseRequiredTarget(body.kcal, "kcal"),
    protein_g: parseRequiredTarget(body.protein_g, "protein_g"),
    fat_g: parseRequiredTarget(body.fat_g, "fat_g"),
    carb_g: parseRequiredTarget(body.carb_g, "carb_g"),
  };
}

function parseOptionalInt(value: unknown, label: string, allowNegative = false): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n === 0 || (!allowNegative && n < 0)) {
    throw createError({ statusCode: 400, statusMessage: `${label} is invalid.` });
  }
  return n;
}

export function parseIntakeInput(body: Record<string, unknown>): NutritionIntakeInput {
  const fdcId = parseOptionalInt(body.fdc_id, "fdc_id");
  const portionId = parseOptionalInt(body.portion_id, "portion_id", true);

  const quantityRaw = body.quantity == null || body.quantity === "" ? 1 : Number(body.quantity);
  if (!Number.isFinite(quantityRaw) || quantityRaw <= 0) {
    throw createError({ statusCode: 400, statusMessage: "quantity must be greater than 0." });
  }

  const gramWeight = asNullableNumber(body.gram_weight);
  if (gramWeight != null && gramWeight <= 0) {
    throw createError({ statusCode: 400, statusMessage: "gram_weight must be greater than 0." });
  }

  const foodName = String(body.food_name ?? body.food_description ?? "").trim() || null;
  const portionLabel = String(body.portion_label ?? "").trim() || null;

  return {
    eaten_on: parseEatenOn(body.eaten_on ?? body.date),
    eaten_at: parseEatenAt(body.eaten_at),
    meal: parseMealType(body.meal ?? body.meal_type),
    fdc_id: fdcId,
    portion_id: portionId,
    quantity: quantityRaw,
    gram_weight: gramWeight,
    food_name: foodName,
    portion_label: portionLabel,
    kcal: asNullableNumber(body.kcal),
    protein_g: asNullableNumber(body.protein_g),
    fat_g: asNullableNumber(body.fat_g),
    carb_g: asNullableNumber(body.carb_g),
    kcal_per_100g: asNullableNumber(body.kcal_per_100g),
    protein_g_per_100g: asNullableNumber(body.protein_g_per_100g),
    fat_g_per_100g: asNullableNumber(body.fat_g_per_100g),
    carb_g_per_100g: asNullableNumber(body.carb_g_per_100g),
  };
}

export function parseEntryId(raw: string | undefined) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "Invalid intake entry id." });
  }
  return id;
}

export function mapNutritionWriteError(error: unknown, fallback: string) {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : "";
  const msg = String((error as { message?: string })?.message ?? "");
  if (code === "42P01" || code === "42703") {
    return createError({
      statusCode: 500,
      statusMessage: "Nutrition tables are not set up yet. Run database migrations.",
    });
  }
  if (code === "23514" || /gram_weight is required/i.test(msg)) {
    return createError({
      statusCode: 400,
      statusMessage: msg || "Enter grams or a USDA portion.",
    });
  }
  return createError({ statusCode: 500, statusMessage: fallback });
}

function mapPlan(row: Record<string, unknown>): NutritionPlan {
  return {
    plan_id: Number(row.plan_id),
    user_id: Number(row.user_id),
    name: String(row.name),
    kcal: asFiniteNumber(row.kcal),
    protein_g: asFiniteNumber(row.protein_g),
    fat_g: asFiniteNumber(row.fat_g),
    carb_g: asFiniteNumber(row.carb_g),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

const PLAN_COLUMNS = `plan_id, user_id, name, kcal, protein_g, fat_g, carb_g, created_at, updated_at`;

function detailPayload(detail: FdcFoodDetail) {
  const nutrients = [
    { nutrient_id: 1008, name: "Energy", unit_name: "kcal", rank: 300, amount: detail.kcal_per_100g },
    { nutrient_id: 1003, name: "Protein", unit_name: "g", rank: 600, amount: detail.protein_g_per_100g },
    { nutrient_id: 1004, name: "Total lipid (fat)", unit_name: "g", rank: 800, amount: detail.fat_g_per_100g },
    { nutrient_id: 1005, name: "Carbohydrate, by difference", unit_name: "g", rank: 1110, amount: detail.carb_g_per_100g },
  ].filter((n) => n.amount != null);

  return {
    fdc_id: detail.fdc_id,
    description: detail.description,
    category: detail.category,
    data_type: detail.data_type,
    kcal_per_100g: detail.kcal_per_100g,
    protein_g_per_100g: detail.protein_g_per_100g,
    fat_g_per_100g: detail.fat_g_per_100g,
    carb_g_per_100g: detail.carb_g_per_100g,
    is_branded: detail.is_branded,
    brand_owner: detail.brand_owner,
    brand_name: detail.brand_name,
    nutrients,
    portions: detail.portions,
  };
}

export async function searchNutritionFoods(
  query: string,
  limit = 25,
): Promise<{ foods: NutritionFoodSearchHit[]; fdc_search: FdcSearchStatus }> {
  const q = String(query || "").trim();
  if (!q) {
    return { foods: [], fdc_search: fdcSearchStatus("") };
  }
  const { foods, errorCode } = await searchFdcFoods(q, limit);
  return { foods, fdc_search: fdcSearchStatus(q, errorCode) };
}

export async function getNutritionFoodDetail(fdcId: number) {
  const detail = await getFdcFoodDetail(fdcId);
  if (!detail) return null;
  return detailPayload(detail);
}

async function resolveLoggedServing(input: NutritionIntakeInput) {
  const detail = input.fdc_id ? await getFdcFoodDetail(input.fdc_id) : null;
  const portion =
    input.portion_id != null && detail
      ? detail.portions.find((item) => item.portion_id === input.portion_id) || null
      : null;

  let gramWeight = input.gram_weight;
  if (gramWeight == null && portion) {
    gramWeight = portion.gram_weight * input.quantity;
  }
  if (gramWeight == null || gramWeight <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Provide a USDA portion or gram_weight.",
    });
  }

  const foodName = (input.food_name || detail?.description || "").trim();
  if (!foodName) {
    throw createError({
      statusCode: 400,
      statusMessage: "Could not load that food from USDA FoodData Central.",
    });
  }

  const portionLabel =
    input.portion_label ||
    (portion ? householdPortionLabel(portion) || portion.label : "") ||
    (input.portion_id != null ? "portion" : "custom grams");

  const per100 = {
    kcal: input.kcal_per_100g ?? detail?.kcal_per_100g ?? null,
    protein_g: input.protein_g_per_100g ?? detail?.protein_g_per_100g ?? null,
    fat_g: input.fat_g_per_100g ?? detail?.fat_g_per_100g ?? null,
    carb_g: input.carb_g_per_100g ?? detail?.carb_g_per_100g ?? null,
  };
  const scaled = scaleMacrosToGrams(per100, gramWeight);

  const hasEatenSnapshot =
    input.kcal != null || input.protein_g != null || input.fat_g != null || input.carb_g != null;
  const hasPer100 = per100.kcal != null || per100.protein_g != null || per100.fat_g != null || per100.carb_g != null;
  if (!detail && !hasEatenSnapshot && !hasPer100) {
    throw createError({
      statusCode: 400,
      statusMessage: "Could not load that food from USDA FoodData Central.",
    });
  }

  return {
    fdc_id: input.fdc_id,
    food_name: foodName,
    portion_label: portionLabel,
    gram_weight: gramWeight,
    kcal: scaled.kcal ?? input.kcal,
    protein_g: scaled.protein_g ?? input.protein_g,
    fat_g: scaled.fat_g ?? input.fat_g,
    carb_g: scaled.carb_g ?? input.carb_g,
    portion_id: input.portion_id,
    quantity: input.quantity,
  };
}

export async function listIntakeEntries(
  client: Client,
  userId: number,
  eatenOn: string,
): Promise<NutritionIntakeEntry[]> {
  const result = await client.query(
    `SELECT e.entry_id, e.user_id, e.eaten_on::text, e.eaten_at, e.meal, e.fdc_id, e.portion_id,
            e.quantity, e.gram_weight, e.created_at,
            e.food_name, e.portion_label,
            e.kcal, e.protein_g, e.fat_g, e.carb_g
     FROM nutrition_intake_entries e
     WHERE ${privateUserClause("e")} AND e.eaten_on = $2
     ORDER BY e.eaten_at, e.entry_id`,
    [userId, eatenOn],
  );
  return result.rows.map((row) => {
    const meal = row.meal ?? null;
    const foodName = row.food_name ?? null;
    return {
      entry_id: Number(row.entry_id),
      user_id: Number(row.user_id),
      eaten_on: String(row.eaten_on),
      eaten_at: asIsoTimestamp(row.eaten_at),
      meal,
      meal_type: meal,
      fdc_id: row.fdc_id != null ? Number(row.fdc_id) : null,
      portion_id: row.portion_id != null ? Number(row.portion_id) : null,
      quantity: asFiniteNumber(row.quantity, 1),
      gram_weight: asNullableNumber(row.gram_weight),
      created_at: String(row.created_at),
      food_name: foodName,
      food_description: foodName,
      portion_label: row.portion_label ?? (row.portion_id != null ? "portion" : "custom grams"),
      kcal: asNullableNumber(row.kcal),
      protein_g: asNullableNumber(row.protein_g),
      fat_g: asNullableNumber(row.fat_g),
      carb_g: asNullableNumber(row.carb_g),
    };
  });
}

export async function getDailyMacros(
  client: Client,
  userId: number,
  eatenOn: string,
): Promise<NutritionDailyMacros | null> {
  const result = await client.query(
    `SELECT e.user_id, e.eaten_on::text,
            SUM(e.kcal) AS kcal,
            SUM(e.protein_g) AS protein_g,
            SUM(e.fat_g) AS fat_g,
            SUM(e.carb_g) AS carb_g
     FROM nutrition_intake_entries e
     WHERE ${privateUserClause("e")} AND e.eaten_on = $2
     GROUP BY e.user_id, e.eaten_on`,
    [userId, eatenOn],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    user_id: Number(row.user_id),
    eaten_on: String(row.eaten_on),
    kcal: asNullableNumber(row.kcal),
    protein_g: asNullableNumber(row.protein_g),
    fat_g: asNullableNumber(row.fat_g),
    carb_g: asNullableNumber(row.carb_g),
  };
}

/** Inclusive daily totals for a date range. Days with no intake are filled with zeros. */
export async function listDailyMacrosRange(
  client: Client,
  userId: number,
  startOn: string,
  endOn: string,
): Promise<NutritionDailyMacros[]> {
  const result = await client.query(
    `SELECT e.eaten_on::text,
            SUM(e.kcal) AS kcal,
            SUM(e.protein_g) AS protein_g,
            SUM(e.fat_g) AS fat_g,
            SUM(e.carb_g) AS carb_g
     FROM nutrition_intake_entries e
     WHERE ${privateUserClause("e")} AND e.eaten_on >= $2 AND e.eaten_on <= $3
     GROUP BY e.eaten_on
     ORDER BY e.eaten_on`,
    [userId, startOn, endOn],
  );
  const byDate = new Map(result.rows.map((row) => [String(row.eaten_on), row]));
  return enumerateIsoDatesInclusive(startOn, endOn).map((eaten_on) => {
    const row = byDate.get(eaten_on);
    return {
      eaten_on,
      kcal: asFiniteNumber(row?.kcal),
      protein_g: asFiniteNumber(row?.protein_g),
      fat_g: asFiniteNumber(row?.fat_g),
      carb_g: asFiniteNumber(row?.carb_g),
    };
  });
}

export async function getActiveNutritionPlan(client: Client, userId: number): Promise<NutritionPlan | null> {
  const result = await client.query(
    `SELECT ${PLAN_COLUMNS}
     FROM nutrition_plans
     WHERE ${privateUserClause()}
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId],
  );
  return result.rows[0] ? mapPlan(result.rows[0]) : null;
}

export async function upsertActiveNutritionPlan(
  client: Client,
  userId: number,
  input: NutritionPlanInput,
): Promise<NutritionPlan> {
  const result = await client.query(
    `INSERT INTO nutrition_plans (user_id, name, kcal, protein_g, fat_g, carb_g)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       name = EXCLUDED.name,
       kcal = EXCLUDED.kcal,
       protein_g = EXCLUDED.protein_g,
       fat_g = EXCLUDED.fat_g,
       carb_g = EXCLUDED.carb_g,
       updated_at = NOW()
     RETURNING ${PLAN_COLUMNS}`,
    [userId, input.name, input.kcal, input.protein_g, input.fat_g, input.carb_g],
  );
  return mapPlan(result.rows[0]);
}

export async function createIntakeEntry(
  client: Client,
  userId: number,
  input: NutritionIntakeInput,
): Promise<{ entry_id: number }> {
  const snapshot = await resolveLoggedServing(input);
  const result = await client.query(
    `INSERT INTO nutrition_intake_entries
       (user_id, eaten_on, eaten_at, meal, fdc_id, portion_id, quantity, gram_weight,
        food_name, kcal, protein_g, fat_g, carb_g, portion_label)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING entry_id`,
    [
      userId,
      input.eaten_on,
      input.eaten_at,
      input.meal,
      snapshot.fdc_id,
      snapshot.portion_id,
      snapshot.quantity,
      snapshot.gram_weight,
      snapshot.food_name,
      snapshot.kcal,
      snapshot.protein_g,
      snapshot.fat_g,
      snapshot.carb_g,
      snapshot.portion_label,
    ],
  );
  return { entry_id: Number(result.rows[0].entry_id) };
}

export async function deleteIntakeEntry(client: Client, userId: number, entryId: number) {
  const result = await client.query(
    `DELETE FROM nutrition_intake_entries
     WHERE entry_id = $2 AND ${privateUserClauseAt("", 1)}
     RETURNING entry_id`,
    [userId, entryId],
  );
  if (!result.rowCount) {
    throw createError({ statusCode: 404, statusMessage: "Intake entry not found." });
  }
}

export function emptyMacroTotals(): NutritionMacroTotals {
  return { kcal: 0, protein_g: 0, fat_g: 0, carb_g: 0 };
}

export function buildNutritionComparison(
  macros: NutritionDailyMacros | null,
  plan: NutritionPlan | null,
): NutritionComparison {
  const consumed: NutritionMacroTotals = {
    kcal: asFiniteNumber(macros?.kcal),
    protein_g: asFiniteNumber(macros?.protein_g),
    fat_g: asFiniteNumber(macros?.fat_g),
    carb_g: asFiniteNumber(macros?.carb_g),
  };
  if (!plan) {
    return { consumed, targets: null, remaining: null };
  }
  const targets: NutritionMacroTotals = {
    kcal: plan.kcal,
    protein_g: plan.protein_g,
    fat_g: plan.fat_g,
    carb_g: plan.carb_g,
  };
  return {
    consumed,
    targets,
    remaining: {
      kcal: targets.kcal - consumed.kcal,
      protein_g: targets.protein_g - consumed.protein_g,
      fat_g: targets.fat_g - consumed.fat_g,
      carb_g: targets.carb_g - consumed.carb_g,
    },
  };
}
