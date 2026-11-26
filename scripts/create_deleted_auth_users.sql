-- Tombstone for a Supabase sign-in whose app account was deleted.
-- Keyed by supabase_user_id so supabase-link cannot open a new empty account
-- for that sign-in. auth_deleted_at stays null until the Auth user is removed.
-- Safe to run more than once. Does not delete rows.

CREATE TABLE IF NOT EXISTS deleted_auth_users (
  supabase_user_id UUID PRIMARY KEY,
  app_user_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  auth_deleted_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_deleted_auth_users_pending
  ON deleted_auth_users (created_at)
  WHERE auth_deleted_at IS NULL;

ALTER TABLE deleted_auth_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE deleted_auth_users FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE deleted_auth_users FROM authenticated';
  END IF;
END $$;
