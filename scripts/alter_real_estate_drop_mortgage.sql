-- Remove mortgage columns from real_estate table
-- Run against estate_mgmt_db
-- Usage: psql -U estate_user -d estate_mgmt_db -f alter_real_estate_drop_mortgage.sql

ALTER TABLE real_estate DROP COLUMN IF EXISTS mortgage_amt;
ALTER TABLE real_estate DROP COLUMN IF EXISTS mortgage_company;
ALTER TABLE real_estate DROP COLUMN IF EXISTS mortgage_co_url;
