-- Add profile_photo column to app_users (stores base64 data URL, max 240x240)
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
