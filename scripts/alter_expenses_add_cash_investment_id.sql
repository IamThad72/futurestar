-- Link savings/investment budget items to cash accounts
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS cash_investment_id INTEGER REFERENCES cash_and_investments(ci_id) ON DELETE SET NULL;
