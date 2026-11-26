-- Estate files whose rows are gone but whose bytes still need to be removed.
-- Retried after account deletion. Safe to run more than once. Does not delete rows.

CREATE TABLE IF NOT EXISTS pending_storage_deletes (
  storage_backend TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (storage_backend, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_pending_storage_deletes_open
  ON pending_storage_deletes (created_at)
  WHERE deleted_at IS NULL;

ALTER TABLE pending_storage_deletes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE pending_storage_deletes FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE pending_storage_deletes FROM authenticated';
  END IF;
END $$;
