-- Add destination account for savings/investment transactions
ALTER TABLE budget_transactions
  ADD COLUMN IF NOT EXISTS cash_investment_id INTEGER REFERENCES cash_and_investments(ci_id) ON DELETE SET NULL;
