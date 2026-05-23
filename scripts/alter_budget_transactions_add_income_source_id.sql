-- Link income transactions to an income source (Budget Tracker "From")
ALTER TABLE budget_transactions
  ADD COLUMN IF NOT EXISTS income_source_id INTEGER REFERENCES income_sources(source_id) ON DELETE SET NULL;

