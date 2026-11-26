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
