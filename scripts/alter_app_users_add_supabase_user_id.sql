-- Add supabase_user_id to link Supabase Auth users to app_users.
-- Enables JWT-based auth while keeping app_users/groups unchanged.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS supabase_user_id UUID UNIQUE;

-- Allow password_hash to be null for Supabase-only users (no local password).
ALTER TABLE app_users ALTER COLUMN password_hash DROP NOT NULL;
