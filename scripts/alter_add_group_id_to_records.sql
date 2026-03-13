-- Add group_id to share records between linked accounts
ALTER TABLE asset_inventory
  ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL;

ALTER TABLE asset_vehicles
  ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL;

ALTER TABLE cash_and_investments
  ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL;

ALTER TABLE debt
  ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL;

ALTER TABLE insurance
  ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL;

ALTER TABLE real_estate
  ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL;

ALTER TABLE estate_entries
  ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(group_id) ON DELETE SET NULL;
