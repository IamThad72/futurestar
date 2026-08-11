-- Annual Income / Pre-tax totals for the Tax page (per budget + fiscal year).
CREATE TABLE IF NOT EXISTS fiscal_annual_totals (
    fiscal_total_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    budget_id INTEGER NOT NULL REFERENCES budgets(budget_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL,
    tax_year INTEGER NOT NULL,
    section TEXT NOT NULL,
    total_kind TEXT NOT NULL,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fiscal_annual_totals_section_check CHECK (
      section IN ('income', 'pretax', 'posttax')
    ),
    CONSTRAINT fiscal_annual_totals_kind_check CHECK (
      (section = 'income' AND total_kind IN ('gross', 'net', 'taxable'))
      OR
      (section = 'pretax' AND total_kind IN ('medical', 'dental', 'vision', '401k', 'hsa'))
      OR
      (section = 'posttax' AND total_kind IN ('supplemental_life', 'stock_option_offset'))
    ),
    CONSTRAINT fiscal_annual_totals_year_check CHECK (tax_year >= 2000 AND tax_year <= 2100)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_annual_totals_unique
  ON fiscal_annual_totals (budget_id, tax_year, section, total_kind);

CREATE INDEX IF NOT EXISTS idx_fiscal_annual_totals_budget_year
  ON fiscal_annual_totals (budget_id, tax_year);
CREATE INDEX IF NOT EXISTS idx_fiscal_annual_totals_group
  ON fiscal_annual_totals (group_id) WHERE group_id IS NOT NULL;
