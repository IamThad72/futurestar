-- Link savings transactions to a savings source (Budget Tracker "From")
ALTER TABLE budget_transactions
  ADD COLUMN IF NOT EXISTS savings_source_id INTEGER REFERENCES savings_sources(source_id) ON DELETE SET NULL;
