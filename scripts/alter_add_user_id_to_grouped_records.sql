-- Add user_id to tables that need owner tracking
ALTER TABLE asset_vehicles
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_users(user_id) ON DELETE CASCADE;

ALTER TABLE debt
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_users(user_id) ON DELETE CASCADE;

ALTER TABLE insurance
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_users(user_id) ON DELETE CASCADE;

ALTER TABLE real_estate
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_users(user_id) ON DELETE CASCADE;
