-- Household tax profile for one tax year, keyed the same way as tax_annual_totals
-- (household_key + tax_year). Idempotent. Does not DROP TABLE and does not delete rows.
-- Safe to run more than once. The older tax_profiles table, if it exists, is left in place.
--
-- Owner seed (do not run until household_key is known; the Tax page shows it):
-- Married filing jointly, 1 child under 17, standard deduction, Ohio.
-- Exemption count is derived as taxpayer + spouse + that child = 3.
-- The Ohio rules file applies the joint filing credit on every married-filing-jointly return
-- (it assumes each spouse has at least $500 of qualifying Ohio income).
-- Wooster city tax 1.5% (stored as 0.015), Wooster CSD school district tax 0%.
-- Ohio selects the municipal wage rule, so 401(k) is not subtracted from local wages.
-- A solo household key is u:USER_ID. A linked-account household key is g:GROUP_ID.
--
-- INSERT INTO tax_household_profiles (
--   user_id, group_id, household_key, tax_year,
--   filing_status, state_code, children_under_17, other_dependents,
--   deduction_method, local_jurisdiction, local_county, local_zip, school_district,
--   city_rate, school_district_rate, paychecks_per_year
-- ) VALUES (
--   YOUR_USER_ID, NULL, 'u:YOUR_USER_ID', 2026,
--   'married_filing_jointly', 'OH', 1, 0,
--   'standard', 'Wooster', 'Wayne County', '44691', 'Wooster CSD',
--   0.015, 0, 26
-- )
-- ON CONFLICT (household_key, tax_year) DO UPDATE SET
--   filing_status = EXCLUDED.filing_status,
--   state_code = EXCLUDED.state_code,
--   children_under_17 = EXCLUDED.children_under_17,
--   other_dependents = EXCLUDED.other_dependents,
--   deduction_method = EXCLUDED.deduction_method,
--   local_jurisdiction = EXCLUDED.local_jurisdiction,
--   local_county = EXCLUDED.local_county,
--   local_zip = EXCLUDED.local_zip,
--   school_district = EXCLUDED.school_district,
--   city_rate = EXCLUDED.city_rate,
--   school_district_rate = EXCLUDED.school_district_rate,
--   paychecks_per_year = EXCLUDED.paychecks_per_year,
--   updated_at = NOW();

CREATE TABLE IF NOT EXISTS tax_household_profiles (
    profile_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL,
    household_key TEXT NOT NULL,
    tax_year INTEGER NOT NULL,
    filing_status TEXT NOT NULL,
    state_code TEXT NOT NULL,
    children_under_17 INTEGER NOT NULL DEFAULT 0,
    other_dependents INTEGER NOT NULL DEFAULT 0,
    deduction_method TEXT NOT NULL DEFAULT 'standard',
    itemized_deduction NUMERIC(14, 2) NOT NULL DEFAULT 0,
    local_jurisdiction TEXT,
    local_county TEXT,
    local_zip TEXT,
    school_district TEXT,
    city_rate NUMERIC(8, 6) NOT NULL DEFAULT 0,
    school_district_rate NUMERIC(8, 6) NOT NULL DEFAULT 0,
    local_wage_rule TEXT,
    paychecks_per_year INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tax_household_profiles ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL;
ALTER TABLE tax_household_profiles ADD COLUMN IF NOT EXISTS household_key TEXT;
ALTER TABLE tax_household_profiles ADD COLUMN IF NOT EXISTS tax_year INTEGER;
ALTER TABLE tax_household_profiles ADD COLUMN IF NOT EXISTS filing_status TEXT;
ALTER TABLE tax_household_profiles ADD COLUMN IF NOT EXISTS state_code TEXT;
ALTER TABLE tax_household_profiles ADD COLUMN IF NOT EXISTS children_under_17 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tax_household_profiles ADD COLUMN IF NOT EXISTS other_dependents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tax_household_profiles ADD COLUMN IF NOT EXISTS deduction_method TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE tax_household_profiles ADD COLUMN IF NOT EXISTS itemized_deduction NUMERIC(14, 2) NOT NULL DEFAULT 0;
ALTER TABLE tax_household_profiles ADD COLUMN IF NOT EXISTS local_jurisdiction TEXT;
ALTER TABLE tax_household_profiles ADD COLUMN IF NOT EXISTS local_county TEXT;
ALTER TABLE tax_household_profiles ADD COLUMN IF NOT EXISTS local_zip TEXT;
ALTER TABLE tax_household_profiles ADD COLUMN IF NOT EXISTS school_district TEXT;
ALTER TABLE tax_household_profiles ADD COLUMN IF NOT EXISTS city_rate NUMERIC(8, 6) NOT NULL DEFAULT 0;
ALTER TABLE tax_household_profiles ADD COLUMN IF NOT EXISTS school_district_rate NUMERIC(8, 6) NOT NULL DEFAULT 0;
ALTER TABLE tax_household_profiles ADD COLUMN IF NOT EXISTS local_wage_rule TEXT;
ALTER TABLE tax_household_profiles ADD COLUMN IF NOT EXISTS paychecks_per_year INTEGER;
ALTER TABLE tax_household_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE tax_household_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_household_profiles_household_year
  ON tax_household_profiles (household_key, tax_year);

ALTER TABLE tax_household_profiles DROP CONSTRAINT IF EXISTS tax_household_profiles_filing_status_check;
ALTER TABLE tax_household_profiles ADD CONSTRAINT tax_household_profiles_filing_status_check CHECK (
  filing_status IN (
    'single',
    'married_filing_jointly',
    'married_filing_separately',
    'head_of_household',
    'qualifying_surviving_spouse'
  )
);

ALTER TABLE tax_household_profiles DROP CONSTRAINT IF EXISTS tax_household_profiles_deduction_method_check;
ALTER TABLE tax_household_profiles ADD CONSTRAINT tax_household_profiles_deduction_method_check CHECK (
  deduction_method IN ('standard', 'itemized')
);

ALTER TABLE tax_household_profiles DROP CONSTRAINT IF EXISTS tax_household_profiles_dependents_check;
ALTER TABLE tax_household_profiles ADD CONSTRAINT tax_household_profiles_dependents_check CHECK (
  children_under_17 >= 0
  AND children_under_17 <= 20
  AND other_dependents >= 0
  AND other_dependents <= 20
);

ALTER TABLE tax_household_profiles DROP CONSTRAINT IF EXISTS tax_household_profiles_rates_check;
ALTER TABLE tax_household_profiles ADD CONSTRAINT tax_household_profiles_rates_check CHECK (
  city_rate >= 0 AND city_rate <= 0.15
  AND school_district_rate >= 0 AND school_district_rate <= 0.15
  AND itemized_deduction >= 0
  AND (paychecks_per_year IS NULL OR (paychecks_per_year > 0 AND paychecks_per_year <= 366))
  AND tax_year >= 2000 AND tax_year <= 2100
);

-- A line's category can be forced into a deduction type from data/tax/deduction_types.json.
-- deduction_key 'ignore' leaves the line out of the tax totals.
CREATE TABLE IF NOT EXISTS tax_deduction_overrides (
    override_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    household_key TEXT NOT NULL,
    category TEXT NOT NULL,
    sub_category TEXT NOT NULL DEFAULT '',
    deduction_key TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tax_deduction_overrides ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_users(user_id) ON DELETE CASCADE;
ALTER TABLE tax_deduction_overrides ADD COLUMN IF NOT EXISTS household_key TEXT;
ALTER TABLE tax_deduction_overrides ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE tax_deduction_overrides ADD COLUMN IF NOT EXISTS sub_category TEXT NOT NULL DEFAULT '';
ALTER TABLE tax_deduction_overrides ADD COLUMN IF NOT EXISTS deduction_key TEXT;
ALTER TABLE tax_deduction_overrides ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_deduction_overrides_line
  ON tax_deduction_overrides (household_key, category, sub_category);

-- Let new Section 125 and retirement kinds be stored. Existing rows stay.
DO $fiscal_kinds$
BEGIN
  IF to_regclass('public.fiscal_annual_totals') IS NULL THEN
    RAISE NOTICE 'fiscal_annual_totals is missing; deduction kind check was not updated.';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE fiscal_annual_totals DROP CONSTRAINT IF EXISTS fiscal_annual_totals_kind_check';
  EXECUTE $check$
    ALTER TABLE fiscal_annual_totals
    ADD CONSTRAINT fiscal_annual_totals_kind_check CHECK (
      (section = 'income' AND total_kind IN ('gross', 'net', 'taxable'))
      OR
      (section = 'pretax' AND total_kind IN (
        'medical', 'dental', 'vision', 'hsa', 'fsa', 'commuter', '401k', '403b', '457', 'tsp'
      ))
      OR
      (section = 'posttax' AND total_kind IN (
        'roth_401k', 'supplemental_life', 'union_dues', 'garnishments', 'stock_option_offset'
      ))
    )
  $check$;
END
$fiscal_kinds$;

DO $tax_household_rls$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    RAISE NOTICE 'auth.uid() not found; tax household tables left without RLS policies.';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE tax_household_profiles ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE tax_deduction_overrides ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tax_household_profiles_select_own ON tax_household_profiles';
  EXECUTE 'DROP POLICY IF EXISTS tax_household_profiles_insert_own ON tax_household_profiles';
  EXECUTE 'DROP POLICY IF EXISTS tax_household_profiles_update_own ON tax_household_profiles';
  EXECUTE 'DROP POLICY IF EXISTS tax_household_profiles_delete_own ON tax_household_profiles';
  EXECUTE 'DROP POLICY IF EXISTS tax_deduction_overrides_select_own ON tax_deduction_overrides';
  EXECUTE 'DROP POLICY IF EXISTS tax_deduction_overrides_insert_own ON tax_deduction_overrides';
  EXECUTE 'DROP POLICY IF EXISTS tax_deduction_overrides_update_own ON tax_deduction_overrides';
  EXECUTE 'DROP POLICY IF EXISTS tax_deduction_overrides_delete_own ON tax_deduction_overrides';

  EXECUTE $policy$
    CREATE POLICY tax_household_profiles_select_own ON tax_household_profiles
    FOR SELECT USING (
      user_id IN (SELECT au.user_id FROM app_users au WHERE au.supabase_user_id = auth.uid())
    )
  $policy$;
  EXECUTE $policy$
    CREATE POLICY tax_household_profiles_insert_own ON tax_household_profiles
    FOR INSERT WITH CHECK (
      user_id IN (SELECT au.user_id FROM app_users au WHERE au.supabase_user_id = auth.uid())
    )
  $policy$;
  EXECUTE $policy$
    CREATE POLICY tax_household_profiles_update_own ON tax_household_profiles
    FOR UPDATE
    USING (user_id IN (SELECT au.user_id FROM app_users au WHERE au.supabase_user_id = auth.uid()))
    WITH CHECK (user_id IN (SELECT au.user_id FROM app_users au WHERE au.supabase_user_id = auth.uid()))
  $policy$;
  EXECUTE $policy$
    CREATE POLICY tax_household_profiles_delete_own ON tax_household_profiles
    FOR DELETE USING (
      user_id IN (SELECT au.user_id FROM app_users au WHERE au.supabase_user_id = auth.uid())
    )
  $policy$;
  EXECUTE $policy$
    CREATE POLICY tax_deduction_overrides_select_own ON tax_deduction_overrides
    FOR SELECT USING (
      user_id IN (SELECT au.user_id FROM app_users au WHERE au.supabase_user_id = auth.uid())
    )
  $policy$;
  EXECUTE $policy$
    CREATE POLICY tax_deduction_overrides_insert_own ON tax_deduction_overrides
    FOR INSERT WITH CHECK (
      user_id IN (SELECT au.user_id FROM app_users au WHERE au.supabase_user_id = auth.uid())
    )
  $policy$;
  EXECUTE $policy$
    CREATE POLICY tax_deduction_overrides_update_own ON tax_deduction_overrides
    FOR UPDATE
    USING (user_id IN (SELECT au.user_id FROM app_users au WHERE au.supabase_user_id = auth.uid()))
    WITH CHECK (user_id IN (SELECT au.user_id FROM app_users au WHERE au.supabase_user_id = auth.uid()))
  $policy$;
  EXECUTE $policy$
    CREATE POLICY tax_deduction_overrides_delete_own ON tax_deduction_overrides
    FOR DELETE USING (
      user_id IN (SELECT au.user_id FROM app_users au WHERE au.supabase_user_id = auth.uid())
    )
  $policy$;
END
$tax_household_rls$;
