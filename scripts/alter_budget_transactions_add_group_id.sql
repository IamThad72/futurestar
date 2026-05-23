ALTER TABLE budget_transactions
  ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_budget_transactions_group_id
  ON budget_transactions(group_id) WHERE group_id IS NOT NULL;
