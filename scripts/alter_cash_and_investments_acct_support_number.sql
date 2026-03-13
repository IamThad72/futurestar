-- Change acct_support_number to TEXT
ALTER TABLE cash_and_investments
  ALTER COLUMN acct_support_number TYPE TEXT
  USING acct_support_number::TEXT;
