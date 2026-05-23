-- Track the source account for expense transactions (From Account)
ALTER TABLE budget_transactions
  ADD COLUMN IF NOT EXISTS from_cash_investment_id INTEGER REFERENCES cash_and_investments(ci_id) ON DELETE SET NULL;

