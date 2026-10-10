ALTER TABLE budget_transactions
  ADD COLUMN IF NOT EXISTS from_gross_pay BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE tax_annual_totals
  ADD COLUMN IF NOT EXISTS household_key TEXT;

ALTER TABLE fiscal_annual_totals
  ADD COLUMN IF NOT EXISTS household_key TEXT;

CREATE OR REPLACE FUNCTION set_annual_total_household_key()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW.group_id IS NOT NULL THEN
    NEW.household_key := 'g:' || NEW.group_id::text;
  ELSE
    NEW.household_key := 'u:' || NEW.user_id::text;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS tax_annual_totals_household_key ON tax_annual_totals;
CREATE TRIGGER tax_annual_totals_household_key
  BEFORE INSERT OR UPDATE OF user_id, group_id
  ON tax_annual_totals
  FOR EACH ROW
  EXECUTE FUNCTION set_annual_total_household_key();

DROP TRIGGER IF EXISTS fiscal_annual_totals_household_key ON fiscal_annual_totals;
CREATE TRIGGER fiscal_annual_totals_household_key
  BEFORE INSERT OR UPDATE OF user_id, group_id
  ON fiscal_annual_totals
  FOR EACH ROW
  EXECUTE FUNCTION set_annual_total_household_key();

DO $migrate$
DECLARE
  target_key text;
  target_user integer;
  target_group integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tax_annual_totals'
      AND column_name = 'budget_id'
  ) THEN
    RETURN;
  END IF;

  UPDATE tax_annual_totals
  SET household_key = CASE
    WHEN group_id IS NOT NULL THEN 'g:' || group_id::text
    ELSE 'u:' || user_id::text
  END;

  UPDATE fiscal_annual_totals
  SET household_key = CASE
    WHEN group_id IS NOT NULL THEN 'g:' || group_id::text
    ELSE 'u:' || user_id::text
  END;

  ALTER TABLE tax_annual_totals ALTER COLUMN budget_id DROP NOT NULL;
  ALTER TABLE fiscal_annual_totals ALTER COLUMN budget_id DROP NOT NULL;

  SELECT household_key, user_id, group_id
    INTO target_key, target_user, target_group
  FROM tax_annual_totals
  WHERE tax_year = 2026
    AND tax_kind = 'federal'
    AND total_amount = 39037.06
  ORDER BY tax_total_id
  LIMIT 1;

  IF target_key IS NOT NULL THEN
    DELETE FROM tax_annual_totals
    WHERE household_key = target_key
      AND tax_year = 2026;

    INSERT INTO tax_annual_totals (
      user_id, group_id, household_key, tax_year, tax_kind, total_amount, updated_at
    )
    VALUES
      (target_user, target_group, target_key, 2026, 'federal', 39037.06, NOW()),
      (target_user, target_group, target_key, 2026, 'state', 7161.42, NOW()),
      (target_user, target_group, target_key, 2026, 'local', 3780.53, NOW()),
      (target_user, target_group, target_key, 2026, 'medicare', 4122.95, NOW()),
      (target_user, target_group, target_key, 2026, 'social_security', 11439.00, NOW());
  END IF;

  CREATE TEMP TABLE tax_annual_collapsed ON COMMIT DROP AS
  SELECT
    MIN(tax_total_id) AS keep_id,
    household_key,
    tax_year,
    tax_kind,
    SUM(total_amount) AS total_amount
  FROM tax_annual_totals
  GROUP BY household_key, tax_year, tax_kind;

  UPDATE tax_annual_totals t
  SET total_amount = c.total_amount
  FROM tax_annual_collapsed c
  WHERE t.tax_total_id = c.keep_id;

  DELETE FROM tax_annual_totals t
  USING tax_annual_collapsed c
  WHERE t.household_key = c.household_key
    AND t.tax_year = c.tax_year
    AND t.tax_kind = c.tax_kind
    AND t.tax_total_id <> c.keep_id;

  CREATE TEMP TABLE fiscal_annual_collapsed ON COMMIT DROP AS
  SELECT
    MIN(fiscal_total_id) AS keep_id,
    household_key,
    tax_year,
    section,
    total_kind,
    SUM(total_amount) AS total_amount
  FROM fiscal_annual_totals
  GROUP BY household_key, tax_year, section, total_kind;

  UPDATE fiscal_annual_totals t
  SET total_amount = c.total_amount
  FROM fiscal_annual_collapsed c
  WHERE t.fiscal_total_id = c.keep_id;

  DELETE FROM fiscal_annual_totals t
  USING fiscal_annual_collapsed c
  WHERE t.household_key = c.household_key
    AND t.tax_year = c.tax_year
    AND t.section = c.section
    AND t.total_kind = c.total_kind
    AND t.fiscal_total_id <> c.keep_id;

  ALTER TABLE tax_annual_totals DROP COLUMN budget_id CASCADE;
  ALTER TABLE fiscal_annual_totals DROP COLUMN budget_id CASCADE;
END
$migrate$;

ALTER TABLE tax_annual_totals
  ALTER COLUMN household_key SET NOT NULL;

ALTER TABLE fiscal_annual_totals
  ALTER COLUMN household_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_annual_totals_household
  ON tax_annual_totals (household_key, tax_year, tax_kind);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_annual_totals_household
  ON fiscal_annual_totals (household_key, tax_year, section, total_kind);
