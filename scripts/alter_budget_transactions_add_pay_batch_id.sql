-- Groups the gross, net, tax, and allocation rows saved from one paycheck.
ALTER TABLE budget_transactions
  ADD COLUMN IF NOT EXISTS pay_batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_budget_transactions_pay_batch
  ON budget_transactions (pay_batch_id)
  WHERE pay_batch_id IS NOT NULL;
