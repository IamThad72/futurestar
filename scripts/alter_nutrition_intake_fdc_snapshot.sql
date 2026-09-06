-- Snapshot logged servings onto nutrition_intake_entries, then drop USDA catalog
-- tables. Food search/detail uses the USDA FDC API; only plans + intake remain.

DROP TRIGGER IF EXISTS trg_nutrition_intake_set_grams ON nutrition_intake_entries;
DROP FUNCTION IF EXISTS nutrition_intake_set_grams();

ALTER TABLE nutrition_intake_entries
    ADD COLUMN IF NOT EXISTS food_name TEXT,
    ADD COLUMN IF NOT EXISTS kcal NUMERIC(12, 4),
    ADD COLUMN IF NOT EXISTS protein_g NUMERIC(12, 4),
    ADD COLUMN IF NOT EXISTS fat_g NUMERIC(12, 4),
    ADD COLUMN IF NOT EXISTS carb_g NUMERIC(12, 4),
    ADD COLUMN IF NOT EXISTS portion_label TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'usda_foods'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'usda_food_macros'
    ) THEN
      UPDATE nutrition_intake_entries e
      SET
        food_name = COALESCE(e.food_name, f.description),
        kcal = COALESCE(e.kcal, m.kcal * (e.gram_weight / 100.0)),
        protein_g = COALESCE(e.protein_g, m.protein_g * (e.gram_weight / 100.0)),
        fat_g = COALESCE(e.fat_g, m.fat_g * (e.gram_weight / 100.0)),
        carb_g = COALESCE(e.carb_g, m.carb_g * (e.gram_weight / 100.0))
      FROM usda_foods f
      LEFT JOIN usda_food_macros m ON m.fdc_id = f.fdc_id
      WHERE e.fdc_id = f.fdc_id;
    ELSE
      UPDATE nutrition_intake_entries e
      SET food_name = COALESCE(e.food_name, f.description)
      FROM usda_foods f
      WHERE e.fdc_id = f.fdc_id;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'usda_food_portions'
  ) THEN
    UPDATE nutrition_intake_entries e
    SET portion_label = COALESCE(
      e.portion_label,
      NULLIF(btrim(concat_ws(' ', p.amount::text, p.unit)), ''),
      'portion'
    )
    FROM usda_food_portions p
    WHERE p.portion_id = e.portion_id;
  END IF;

  UPDATE nutrition_intake_entries
  SET portion_label = COALESCE(portion_label, 'custom grams')
  WHERE portion_label IS NULL;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_class frel ON frel.oid = con.confrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'nutrition_intake_entries'
      AND con.contype = 'f'
      AND frel.relname LIKE 'usda_%'
  LOOP
    EXECUTE format('ALTER TABLE nutrition_intake_entries DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE nutrition_intake_entries ALTER COLUMN fdc_id DROP NOT NULL;

DROP VIEW IF EXISTS nutrition_daily_macros CASCADE;
DROP VIEW IF EXISTS nutrition_daily_totals CASCADE;
DROP VIEW IF EXISTS nutrition_entry_nutrients CASCADE;
DROP VIEW IF EXISTS usda_food_energy CASCADE;

DROP TABLE IF EXISTS usda_food_nutrients CASCADE;
DROP TABLE IF EXISTS usda_nutrients CASCADE;
DROP TABLE IF EXISTS usda_measure_units CASCADE;
DROP TABLE IF EXISTS usda_food_categories CASCADE;
DROP TABLE IF EXISTS usda_food_portions CASCADE;
DROP TABLE IF EXISTS usda_food_macros CASCADE;
DROP TABLE IF EXISTS usda_branded_foods CASCADE;
DROP TABLE IF EXISTS usda_foods CASCADE;
