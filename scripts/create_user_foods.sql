-- Private custom foods for Nutrition Journal.
-- Scoped by user_id only. Never add group_id.
-- Macros are amounts for one serving (serving_g grams).

CREATE TABLE IF NOT EXISTS user_foods (
    food_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    brand TEXT,
    serving_label TEXT NOT NULL DEFAULT '1 serving',
    serving_g NUMERIC(12, 4) NOT NULL,
    kcal NUMERIC(12, 4) NOT NULL DEFAULT 0,
    protein_g NUMERIC(12, 4) NOT NULL DEFAULT 0,
    fat_g NUMERIC(12, 4) NOT NULL DEFAULT 0,
    carb_g NUMERIC(12, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_foods_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT user_foods_serving_g_check CHECK (serving_g > 0),
    CONSTRAINT user_foods_kcal_check CHECK (kcal >= 0),
    CONSTRAINT user_foods_protein_check CHECK (protein_g >= 0),
    CONSTRAINT user_foods_fat_check CHECK (fat_g >= 0),
    CONSTRAINT user_foods_carb_check CHECK (carb_g >= 0)
);

CREATE INDEX IF NOT EXISTS idx_user_foods_user_name
    ON user_foods (user_id, lower(name));

ALTER TABLE nutrition_intake_entries
    ADD COLUMN IF NOT EXISTS user_food_id INTEGER REFERENCES user_foods(food_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nutrition_intake_user_food
    ON nutrition_intake_entries (user_food_id);
