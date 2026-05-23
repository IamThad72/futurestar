-- Link budget expense lines to Estate Management debt (loans / credit cards)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS debt_id INTEGER REFERENCES debt(dbt_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_debt_id ON expenses(debt_id);
