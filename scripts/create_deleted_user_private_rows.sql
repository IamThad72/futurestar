-- Private asset, vehicle, and cash rows kept 90 days after the owner is deleted.
-- user_id on the source row is cleared, so a reused app_users id cannot see it.
-- The former id lives only here. Safe to run more than once. Does not delete rows.

CREATE TABLE IF NOT EXISTS deleted_user_private_rows (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name TEXT NOT NULL,
  row_pk TEXT NOT NULL,
  former_user_id BIGINT NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purge_after TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  UNIQUE (table_name, row_pk)
);

CREATE INDEX IF NOT EXISTS idx_deleted_user_private_rows_purge
  ON deleted_user_private_rows (purge_after);

ALTER TABLE deleted_user_private_rows ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE deleted_user_private_rows FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE deleted_user_private_rows FROM authenticated';
  END IF;
END $$;
