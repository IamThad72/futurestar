-- Destination cash/investment account for income deposits (e.g. Net Pay → checking)
ALTER TABLE income
  ADD COLUMN IF NOT EXISTS cash_investment_id INTEGER REFERENCES cash_and_investments(ci_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_income_cash_investment_id
  ON income(cash_investment_id) WHERE cash_investment_id IS NOT NULL;
