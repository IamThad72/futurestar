-- Applied after Supabase → local restore.
-- Keeps app column/table names; tightens map uniqueness and query indexes.

DROP INDEX IF EXISTS idx_account_map_layouts_owner;
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_map_layouts_budget
  ON account_map_layouts (budget_id);

CREATE INDEX IF NOT EXISTS idx_budget_transactions_date
  ON budget_transactions (transaction_date);

CREATE INDEX IF NOT EXISTS idx_income_budget ON income (budget_id);
CREATE INDEX IF NOT EXISTS idx_expenses_budget ON expenses (budget_id);
