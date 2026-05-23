-- Link budget transactions to Estate Management debt (loans / credit cards)
ALTER TABLE budget_transactions
  ADD COLUMN IF NOT EXISTS debt_id INTEGER REFERENCES debt(dbt_id) ON DELETE SET NULL;

ALTER TABLE budget_transactions
  DROP CONSTRAINT IF EXISTS budget_tx_ci_or_debt;

ALTER TABLE budget_transactions
  ADD CONSTRAINT budget_tx_ci_or_debt CHECK (
    cash_investment_id IS NULL OR debt_id IS NULL
  );
