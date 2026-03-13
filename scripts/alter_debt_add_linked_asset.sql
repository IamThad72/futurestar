-- Add linked asset columns to debt table for associating debt with assets
-- Run against estate_mgmt_db
-- Usage: psql -U estate_user -d estate_mgmt_db -f alter_debt_add_linked_asset.sql

ALTER TABLE debt
  ADD COLUMN IF NOT EXISTS linked_asset_type TEXT;

ALTER TABLE debt
  ADD COLUMN IF NOT EXISTS linked_asset_id INTEGER;
