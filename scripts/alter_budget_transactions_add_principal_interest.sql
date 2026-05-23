-- Track principal vs interest applied on debt payments
ALTER TABLE budget_transactions
  ADD COLUMN IF NOT EXISTS principal_applied NUMERIC(12, 2);

ALTER TABLE budget_transactions
  ADD COLUMN IF NOT EXISTS interest_applied NUMERIC(12, 2);
