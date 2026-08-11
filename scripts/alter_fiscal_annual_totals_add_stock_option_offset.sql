-- Allow Stock Option Offset under Post-Tax.
ALTER TABLE fiscal_annual_totals
  DROP CONSTRAINT IF EXISTS fiscal_annual_totals_kind_check;

ALTER TABLE fiscal_annual_totals
  ADD CONSTRAINT fiscal_annual_totals_kind_check CHECK (
    (section = 'income' AND total_kind IN ('gross', 'net', 'taxable'))
    OR
    (section = 'pretax' AND total_kind IN ('medical', 'dental', 'vision', '401k', 'hsa'))
    OR
    (section = 'posttax' AND total_kind IN ('supplemental_life', 'stock_option_offset'))
  );
