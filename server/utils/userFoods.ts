import { createError } from "h3";
import type { Client } from "pg";
import type { FdcFoodDetail, NutritionFoodSearchHit } from "./fdcApi";
import { privateUserClause, privateUserClauseAt } from "./privateUserAccess";

function asFiniteNumber(value: unknown, fallback = 0): number {
  if (value == null || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export type UserFood = {
  food_id: number;
  user_id: number;
  name: string;
  brand: string | null;
  serving_label: string;
  serving_g: number;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  created_at: string;
  updated_at: string;
};

export type UserFoodInput = {
  name: string;
  brand: string | null;
  serving_label: string;
  serving_g: number;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
};

const USER_FOOD_COLUMNS =
  "food_id, user_id, name, brand, serving_label, serving_g, kcal, protein_g, fat_g, carb_g, created_at, updated_at";

function per100(amount: number, servingG: number): number {
  return Math.round(((amount * 100) / servingG) * 10000) / 10000;
}

function mapUserFood(row: Record<string, unknown>): UserFood {
  return {
    food_id: Number(row.food_id),
    user_id: Number(row.user_id),
    name: String(row.name),
    brand: row.brand != null && String(row.brand).trim() ? String(row.brand) : null,
    serving_label: String(row.serving_label || "1 serving"),
    serving_g: asFiniteNumber(row.serving_g),
    kcal: asFiniteNumber(row.kcal),
    protein_g: asFiniteNumber(row.protein_g),
    fat_g: asFiniteNumber(row.fat_g),
    carb_g: asFiniteNumber(row.carb_g),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function userFoodToSearchHit(food: UserFood): NutritionFoodSearchHit {
  return {
    fdc_id: null,
    user_food_id: food.food_id,
    description: food.name,
    category: "Custom",
    data_type: "custom",
    kcal_per_100g: per100(food.kcal, food.serving_g),
    protein_g_per_100g: per100(food.protein_g, food.serving_g),
    fat_g_per_100g: per100(food.fat_g, food.serving_g),
    carb_g_per_100g: per100(food.carb_g, food.serving_g),
    serving_g: food.serving_g,
    serving_label: food.serving_label,
    is_branded: Boolean(food.brand),
    brand_owner: food.brand,
    brand_name: food.brand,
    source: "custom",
  };
}

export function userFoodToDetail(food: UserFood): FdcFoodDetail {
  const hit = userFoodToSearchHit(food);
  return {
    fdc_id: 0,
    description: food.name,
    data_type: "custom",
    category: "Custom",
    brand_owner: food.brand,
    brand_name: food.brand,
    is_branded: Boolean(food.brand),
    kcal_per_100g: hit.kcal_per_100g,
    protein_g_per_100g: hit.protein_g_per_100g,
    fat_g_per_100g: hit.fat_g_per_100g,
    carb_g_per_100g: hit.carb_g_per_100g,
    portions: [
      {
        portion_id: food.food_id,
        amount: 1,
        unit: null,
        measure_name: food.serving_label,
        gram_weight: food.serving_g,
        label: food.serving_label,
      },
    ],
  };
}

export function parseUserFoodId(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw createError({ statusCode: 400, statusMessage: "Invalid custom food id." });
  }
  return n;
}

export function parseUserFoodInput(body: Record<string, unknown>): UserFoodInput {
  const name = String(body.name ?? body.food_name ?? "").trim();
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: "Food name is required." });
  }
  if (name.length > 160) {
    throw createError({ statusCode: 400, statusMessage: "Food name must be 160 characters or fewer." });
  }
  const brandRaw = String(body.brand ?? "").trim();
  const servingLabel = String(body.serving_label ?? "1 serving").trim() || "1 serving";
  if (servingLabel.length > 80) {
    throw createError({ statusCode: 400, statusMessage: "Serving label must be 80 characters or fewer." });
  }
  const servingG = asNullableNumber(body.serving_g);
  if (servingG == null || servingG <= 0) {
    throw createError({ statusCode: 400, statusMessage: "serving_g must be greater than 0." });
  }
  const kcal = asFiniteNumber(body.kcal);
  const protein_g = asFiniteNumber(body.protein_g);
  const fat_g = asFiniteNumber(body.fat_g);
  const carb_g = asFiniteNumber(body.carb_g);
  if (kcal < 0 || protein_g < 0 || fat_g < 0 || carb_g < 0) {
    throw createError({ statusCode: 400, statusMessage: "Macros must be 0 or greater." });
  }
  return {
    name,
    brand: brandRaw || null,
    serving_label: servingLabel,
    serving_g: servingG,
    kcal,
    protein_g,
    fat_g,
    carb_g,
  };
}

export async function listUserFoods(
  client: Client,
  userId: number,
  query = "",
  limit = 25,
): Promise<UserFood[]> {
  const q = String(query || "").trim();
  const cap = Math.min(Math.max(limit, 1), 50);
  if (q) {
    const result = await client.query(
      `SELECT ${USER_FOOD_COLUMNS}
       FROM user_foods
       WHERE ${privateUserClause()} AND (name ILIKE $2 OR COALESCE(brand, '') ILIKE $2)
       ORDER BY updated_at DESC, food_id DESC
       LIMIT $3`,
      [userId, `%${q}%`, cap],
    );
    return result.rows.map(mapUserFood);
  }
  const result = await client.query(
    `SELECT ${USER_FOOD_COLUMNS}
     FROM user_foods
     WHERE ${privateUserClause()}
     ORDER BY updated_at DESC, food_id DESC
     LIMIT $2`,
    [userId, cap],
  );
  return result.rows.map(mapUserFood);
}

export async function getUserFood(client: Client, userId: number, foodId: number): Promise<UserFood | null> {
  const result = await client.query(
    `SELECT ${USER_FOOD_COLUMNS}
     FROM user_foods
     WHERE food_id = $2 AND ${privateUserClauseAt("", 1)}`,
    [userId, foodId],
  );
  return result.rows[0] ? mapUserFood(result.rows[0]) : null;
}

export async function createUserFood(client: Client, userId: number, input: UserFoodInput): Promise<UserFood> {
  const result = await client.query(
    `INSERT INTO user_foods
       (user_id, name, brand, serving_label, serving_g, kcal, protein_g, fat_g, carb_g)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${USER_FOOD_COLUMNS}`,
    [
      userId,
      input.name,
      input.brand,
      input.serving_label,
      input.serving_g,
      input.kcal,
      input.protein_g,
      input.fat_g,
      input.carb_g,
    ],
  );
  return mapUserFood(result.rows[0]);
}
