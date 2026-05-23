-- Source account for savings/investment budget lines (money moving from → to)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS from_cash_investment_id INTEGER REFERENCES cash_and_investments(ci_id) ON DELETE SET NULL;
