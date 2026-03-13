-- Add user_id to asset_vehicles for record ownership (required by /api/records/asset-vehicles)
ALTER TABLE asset_vehicles
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_users(user_id) ON DELETE CASCADE;
