-- Change all value/amount columns to MONEY type
-- Run against estate_mgmt_db
-- Usage: psql -U estate_user -d estate_mgmt_db -f alter_values_to_money.sql

-- asset_inventory
ALTER TABLE asset_inventory
  ALTER COLUMN value TYPE MONEY USING value::money;

-- asset_vehicles
ALTER TABLE asset_vehicles
  ALTER COLUMN value TYPE MONEY USING value::money;

-- real_estate
ALTER TABLE real_estate
  ALTER COLUMN value TYPE MONEY USING value::money;

-- estate_entries
ALTER TABLE estate_entries
  ALTER COLUMN value TYPE MONEY USING value::money;

-- cash_and_investments
ALTER TABLE cash_and_investments
  ALTER COLUMN value TYPE MONEY USING value::money;

-- insurance: policy_amt already MONEY, no change needed
