-- One tax profile per app user. Filing choices live here; income can follow the budget.
-- The Nuxt server scopes rows by app_users.user_id, the same way other private tables
-- are scoped. RLS below is for direct Supabase access (auth.uid() -> app_users.supabase_user_id).
-- Table owners and BYPASSRLS roles, including the server's Postgres role, are not subject to it.

CREATE TABLE IF NOT EXISTS tax_profiles (
    tax_profile_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    filing_status TEXT NOT NULL DEFAULT 'single',
    state_code TEXT NOT NULL DEFAULT '',
    local_jurisdiction TEXT,
    local_zip TEXT,
    local_rate NUMERIC(7, 6),
    children_under_17 INTEGER NOT NULL DEFAULT 0,
    other_dependents INTEGER NOT NULL DEFAULT 0,
    deduction_method TEXT NOT NULL DEFAULT 'standard',
    itemized_deduction NUMERIC(14, 2) NOT NULL DEFAULT 0,
    wages NUMERIC(14, 2),
    self_employment NUMERIC(14, 2),
    retirement NUMERIC(14, 2),
    other_income NUMERIC(14, 2),
    use_budget_income BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tax_profiles_user_unique UNIQUE (user_id),
    CONSTRAINT tax_profiles_filing_status_check CHECK (
      filing_status IN (
        'single',
        'married_filing_jointly',
        'married_filing_separately',
        'head_of_household',
        'qualifying_surviving_spouse'
      )
    ),
    CONSTRAINT tax_profiles_deduction_method_check CHECK (
      deduction_method IN ('standard', 'itemized')
    ),
    CONSTRAINT tax_profiles_dependents_check CHECK (
      children_under_17 >= 0
      AND children_under_17 <= 20
      AND other_dependents >= 0
      AND other_dependents <= 20
    ),
    CONSTRAINT tax_profiles_local_rate_check CHECK (
      local_rate IS NULL OR (local_rate >= 0 AND local_rate <= 0.15)
    ),
    CONSTRAINT tax_profiles_amounts_check CHECK (
      itemized_deduction >= 0
      AND (wages IS NULL OR wages >= 0)
      AND (self_employment IS NULL OR self_employment >= 0)
      AND (retirement IS NULL OR retirement >= 0)
      AND (other_income IS NULL OR other_income >= 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_tax_profiles_user ON tax_profiles (user_id);

DO $tax_profile_rls$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    RAISE NOTICE 'auth.uid() not found; tax_profiles left without RLS policies.';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE tax_profiles ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tax_profiles_select_own ON tax_profiles';
  EXECUTE 'DROP POLICY IF EXISTS tax_profiles_insert_own ON tax_profiles';
  EXECUTE 'DROP POLICY IF EXISTS tax_profiles_update_own ON tax_profiles';
  EXECUTE 'DROP POLICY IF EXISTS tax_profiles_delete_own ON tax_profiles';

  EXECUTE $policy$
    CREATE POLICY tax_profiles_select_own ON tax_profiles
    FOR SELECT
    USING (
      user_id IN (
        SELECT au.user_id FROM app_users au WHERE au.supabase_user_id = auth.uid()
      )
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY tax_profiles_insert_own ON tax_profiles
    FOR INSERT
    WITH CHECK (
      user_id IN (
        SELECT au.user_id FROM app_users au WHERE au.supabase_user_id = auth.uid()
      )
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY tax_profiles_update_own ON tax_profiles
    FOR UPDATE
    USING (
      user_id IN (
        SELECT au.user_id FROM app_users au WHERE au.supabase_user_id = auth.uid()
      )
    )
    WITH CHECK (
      user_id IN (
        SELECT au.user_id FROM app_users au WHERE au.supabase_user_id = auth.uid()
      )
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY tax_profiles_delete_own ON tax_profiles
    FOR DELETE
    USING (
      user_id IN (
        SELECT au.user_id FROM app_users au WHERE au.supabase_user_id = auth.uid()
      )
    )
  $policy$;
END
$tax_profile_rls$;
