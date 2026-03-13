-- Add loan_ammount column to debt table (type MONEY)
-- Run against estate_mgmt_db
-- Usage: psql -U estate_user -d estate_mgmt_db -f alter_debt_add_loan_ammount.sql

ALTER TABLE debt
  ADD COLUMN IF NOT EXISTS loan_ammount MONEY;
