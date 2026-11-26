-- Failed account-deletion password checks, for throttling.
-- Stores a hash of the IP, not the address, and never a password or email.
-- No foreign key to app_users, so the row can outlive the account.
-- Safe to run more than once. Does not delete rows.

CREATE TABLE IF NOT EXISTS account_deletion_attempts (
  attempt_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER,
  ip_hash TEXT NOT NULL,
  succeeded BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_attempts_user
  ON account_deletion_attempts (user_id, attempted_at);

CREATE INDEX IF NOT EXISTS idx_account_deletion_attempts_ip
  ON account_deletion_attempts (ip_hash, attempted_at);

ALTER TABLE account_deletion_attempts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE account_deletion_attempts FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE account_deletion_attempts FROM authenticated';
  END IF;
END $$;
