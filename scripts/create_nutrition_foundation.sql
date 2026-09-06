-- Private Physical nutrition: daily plan + intake log.
-- Food catalog is USDA FoodData Central (live API), not stored locally.
-- Scope by user_id only. Never add group_id.

CREATE TABLE IF NOT EXISTS nutrition_plans (
    plan_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES app_users(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Daily plan',
    kcal NUMERIC(12, 2) NOT NULL,
    protein_g NUMERIC(12, 2) NOT NULL,
    fat_g NUMERIC(12, 2) NOT NULL,
    carb_g NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT nutrition_plans_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT nutrition_plans_kcal_check CHECK (kcal >= 0),
    CONSTRAINT nutrition_plans_protein_check CHECK (protein_g >= 0),
    CONSTRAINT nutrition_plans_fat_check CHECK (fat_g >= 0),
    CONSTRAINT nutrition_plans_carb_check CHECK (carb_g >= 0)
);

-- Logged serving snapshot (kcal/macros are amounts eaten, not per 100 g).
-- fdc_id is an optional USDA reference with no catalog FK.
-- eaten_on is the log day; eaten_at is when that serving was eaten.
CREATE TABLE IF NOT EXISTS nutrition_intake_entries (
    entry_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    eaten_on DATE NOT NULL,
    meal TEXT,
    fdc_id INTEGER,
    portion_id INTEGER,
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 1,
    gram_weight NUMERIC(12, 4),
    food_name TEXT,
    kcal NUMERIC(12, 4),
    protein_g NUMERIC(12, 4),
    fat_g NUMERIC(12, 4),
    carb_g NUMERIC(12, 4),
    portion_label TEXT,
    eaten_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT nutrition_intake_meal_check CHECK (
        meal IS NULL OR meal IN ('breakfast', 'lunch', 'dinner', 'snack', 'other')
    ),
    CONSTRAINT nutrition_intake_quantity_check CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_nutrition_intake_user_date
    ON nutrition_intake_entries (user_id, eaten_on);
CREATE INDEX IF NOT EXISTS idx_nutrition_intake_fdc
    ON nutrition_intake_entries (fdc_id);
