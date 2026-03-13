-- Add income_type to distinguish gross pay, tax, and deductions
-- gross = gross pay/salary (adds to total)
-- tax = income tax withheld (federal, state, FICA, etc.) - subtracted from gross
-- deduction = other deductions (401k, health insurance, etc.) - subtracted from gross
ALTER TABLE income ADD COLUMN IF NOT EXISTS income_type TEXT DEFAULT 'gross';
