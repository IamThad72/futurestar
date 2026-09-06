-- Rebuild nutrition from USDA Foundation only.
-- Drops leftover branded/EAV catalog objects always. Drops Foundation + user
-- nutrition tables only when the old layout is still present (brand_name,
-- category_id, measure_unit_id, meal_type, fiber_g, …). Does not touch
-- exercise, workout, bible, liturgical, or financial tables.

DROP VIEW IF EXISTS nutrition_daily_macros CASCADE;
DROP VIEW IF EXISTS nutrition_daily_totals CASCADE;
DROP VIEW IF EXISTS nutrition_entry_nutrients CASCADE;
DROP VIEW IF EXISTS usda_food_energy CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'usda_food_macros'
  ) THEN
    DROP VIEW public.usda_food_macros CASCADE;
  END IF;
END $$;

DROP TABLE IF EXISTS usda_food_nutrients CASCADE;
DROP TABLE IF EXISTS usda_nutrients CASCADE;
DROP TABLE IF EXISTS usda_measure_units CASCADE;
DROP TABLE IF EXISTS usda_food_categories CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usda_foods'
      AND column_name IN ('brand_name', 'category_id', 'gtin_upc', 'food_class', 'ndb_number')
  ) OR (
    EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'usda_foods'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'usda_foods' AND column_name = 'category'
    )
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usda_food_portions'
      AND column_name IN ('measure_unit_id', 'modifier', 'portion_description')
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'nutrition_plans'
      AND column_name IN ('fiber_g', 'sodium_mg', 'is_active')
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'nutrition_intake_entries'
      -- meal_type/notes are old-layout markers. eaten_at is a current column.
      AND column_name IN ('meal_type', 'notes')
  ) THEN
    DROP TABLE IF EXISTS nutrition_intake_entries CASCADE;
    DROP TABLE IF EXISTS nutrition_plans CASCADE;
    DROP TABLE IF EXISTS usda_food_portions CASCADE;
    DROP TABLE IF EXISTS usda_food_macros CASCADE;
    DROP TABLE IF EXISTS usda_foods CASCADE;
  END IF;
END $$;
