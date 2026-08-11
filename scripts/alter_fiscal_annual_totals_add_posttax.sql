-- Allow Post-Tax Deduction section (e.g. Supplemental Life).
ALTER TABLE fiscal_annual_totals
  DROP CONSTRAINT IF EXISTS fiscal_annual_totals_section_check;

ALTER TABLE fiscal_annual_totals
  ADD CONSTRAINT fiscal_annual_totals_section_check CHECK (
    section IN ('income', 'pretax', 'posttax')
  );

ALTER TABLE fiscal_annual_totals
  DROP CONSTRAINT IF EXISTS fiscal_annual_totals_kind_check;

ALTER TABLE fiscal_annual_totals
  ADD CONSTRAINT fiscal_annual_totals_kind_check CHECK (
    (section = 'income' AND total_kind IN ('gross', 'net', 'taxable'))
    OR
    (section = 'pretax' AND total_kind IN ('medical', 'dental', 'vision', '401k', 'hsa'))
    OR
    (section = 'posttax' AND total_kind IN ('supplemental_life'))
  );
