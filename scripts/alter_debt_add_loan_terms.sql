-- Installment loan / mortgage terms (non-revolving debt)
ALTER TABLE debt
  ADD COLUMN IF NOT EXISTS is_revolving BOOLEAN DEFAULT TRUE;

ALTER TABLE debt
  ADD COLUMN IF NOT EXISTS interest_rate_annual NUMERIC(8, 4);

ALTER TABLE debt
  ADD COLUMN IF NOT EXISTS term_months INTEGER;

ALTER TABLE debt
  ADD COLUMN IF NOT EXISTS scheduled_monthly_payment NUMERIC(12, 2);

ALTER TABLE debt
  ADD COLUMN IF NOT EXISTS loan_start_date DATE;
