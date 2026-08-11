-- Running calendar-year totals for standard tax kinds (per budget).
CREATE TABLE IF NOT EXISTS tax_annual_totals (
    tax_total_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    budget_id INTEGER NOT NULL REFERENCES budgets(budget_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL,
    tax_year INTEGER NOT NULL,
    tax_kind TEXT NOT NULL,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tax_annual_totals_kind_check CHECK (
      tax_kind IN ('federal', 'local', 'medicare', 'social_security', 'state')
    ),
    CONSTRAINT tax_annual_totals_year_check CHECK (tax_year >= 2000 AND tax_year <= 2100)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_annual_totals_unique
  ON tax_annual_totals (budget_id, tax_year, tax_kind);

CREATE INDEX IF NOT EXISTS idx_tax_annual_totals_budget_year
  ON tax_annual_totals (budget_id, tax_year);
CREATE INDEX IF NOT EXISTS idx_tax_annual_totals_group
  ON tax_annual_totals (group_id) WHERE group_id IS NOT NULL;

-- Backfill from existing tax transactions
INSERT INTO tax_annual_totals (budget_id, user_id, group_id, tax_year, tax_kind, total_amount, updated_at)
SELECT
  classified.budget_id,
  classified.user_id,
  classified.group_id,
  classified.tax_year,
  classified.tax_kind,
  SUM(classified.amount) AS total_amount,
  NOW()
FROM (
  SELECT
    i.budget_id,
    i.user_id,
    i.group_id,
    EXTRACT(YEAR FROM t.transaction_date)::int AS tax_year,
    ABS(COALESCE(t.amount, 0)) AS amount,
    CASE
      WHEN lower(coalesce(i.income_category, '') || ' ' || coalesce(i.sub_category, '')) ~ 'social\s*security|fica|\boasdi\b' THEN 'social_security'
      WHEN lower(coalesce(i.income_category, '') || ' ' || coalesce(i.sub_category, '')) ~ 'medicare' THEN 'medicare'
      WHEN lower(coalesce(i.income_category, '') || ' ' || coalesce(i.sub_category, '')) ~ 'federal|\bfed\b' THEN 'federal'
      WHEN lower(coalesce(i.income_category, '') || ' ' || coalesce(i.sub_category, '')) ~ 'local|city|county|municipal' THEN 'local'
      WHEN lower(coalesce(i.income_category, '') || ' ' || coalesce(i.sub_category, '')) ~ 'state' THEN 'state'
      ELSE NULL
    END AS tax_kind
  FROM budget_transactions t
  JOIN income i ON i.income_id = t.income_id
  WHERE COALESCE(i.income_type, 'gross') = 'tax'
    AND t.income_id IS NOT NULL
) classified
WHERE classified.tax_kind IS NOT NULL
GROUP BY classified.budget_id, classified.user_id, classified.group_id, classified.tax_year, classified.tax_kind
ON CONFLICT (budget_id, tax_year, tax_kind) DO UPDATE
  SET total_amount = EXCLUDED.total_amount,
      updated_at = NOW();
