-- Link investment transactions to an investment source (Budget Tracker "From")
ALTER TABLE budget_transactions
  ADD COLUMN IF NOT EXISTS investment_source_id INTEGER REFERENCES investment_sources(source_id) ON DELETE SET NULL;

