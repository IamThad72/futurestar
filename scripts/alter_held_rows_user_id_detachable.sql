-- Detachable user_id on the rows kept for 90 days after account deletion.
--
-- Live catalog (structure-only copy, Nov 26): asset_inventory.user_id,
-- asset_vehicles.user_id, and cash_and_investments.user_id are nullable bigint
-- and have no foreign key to app_users. investment_positions.user_id and
-- vehicle_service_records.user_id are integer NOT NULL with ON DELETE CASCADE.
--
-- Repo scripts disagree and are not what that catalog shows:
--   ARCHIVE/sql-history/scripts/create_asset_inventory.sql
--     user_id INTEGER NOT NULL REFERENCES app_users ON DELETE CASCADE
--   ARCHIVE/sql-history/scripts/alter_add_user_id_to_asset_vehicles.sql
--     user_id INTEGER NULL REFERENCES app_users ON DELETE CASCADE
--   cash_and_investments has no CREATE TABLE in this repo
--   scripts/create_investment_positions.sql
--     user_id INTEGER NOT NULL REFERENCES app_users ON DELETE CASCADE
--   scripts/create_vehicle_service_records.sql
--     user_id INTEGER NOT NULL REFERENCES app_users ON DELETE CASCADE
--
-- The three parent columns stay without a foreign key (bigint cannot reference
-- integer app_users.user_id). The two integer child columns become nullable
-- and reference app_users ON DELETE RESTRICT, so a delete that forgets to
-- detach or reown them fails instead of erasing them.
-- Safe to run more than once. Does not delete rows. Not applied to production.

DO $$
DECLARE
  parents text[] := ARRAY[
    'asset_inventory',
    'asset_vehicles',
    'cash_and_investments'
  ];
  children text[] := ARRAY[
    'investment_positions',
    'vehicle_service_records'
  ];
  fk record;
  held_table text;
  child_table text;
  constraint_name text;
BEGIN
  FOR fk IN
    SELECT c.conname, src.relname AS src_table, c.confdeltype
    FROM pg_constraint c
    JOIN pg_class src ON src.oid = c.conrelid
    JOIN pg_namespace src_ns ON src_ns.oid = src.relnamespace
    JOIN pg_class tgt ON tgt.oid = c.confrelid
    JOIN pg_namespace tgt_ns ON tgt_ns.oid = tgt.relnamespace
    JOIN pg_attribute a ON a.attrelid = src.oid AND a.attnum = ANY (c.conkey) AND NOT a.attisdropped
    WHERE c.contype = 'f'
      AND src_ns.nspname = 'public'
      AND tgt_ns.nspname = 'public'
      AND tgt.relname = 'app_users'
      AND a.attname = 'user_id'
      AND array_length(c.conkey, 1) = 1
      AND src.relname = ANY (parents || children)
      AND NOT (
        src.relname = ANY (children)
        AND c.confdeltype = 'r'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', fk.src_table, fk.conname);
  END LOOP;

  FOREACH held_table IN ARRAY parents || children LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns cols
      WHERE cols.table_schema = 'public'
        AND cols.table_name = held_table
        AND cols.column_name = 'user_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id DROP NOT NULL', held_table);
    END IF;
  END LOOP;

  FOREACH child_table IN ARRAY children LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns cols
      WHERE cols.table_schema = 'public'
        AND cols.table_name = child_table
        AND cols.column_name = 'user_id'
    ) THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class src ON src.oid = c.conrelid
      JOIN pg_namespace src_ns ON src_ns.oid = src.relnamespace
      JOIN pg_class tgt ON tgt.oid = c.confrelid
      JOIN pg_namespace tgt_ns ON tgt_ns.oid = tgt.relnamespace
      JOIN pg_attribute a ON a.attrelid = src.oid AND a.attnum = ANY (c.conkey) AND NOT a.attisdropped
      WHERE c.contype = 'f'
        AND src_ns.nspname = 'public'
        AND tgt_ns.nspname = 'public'
        AND tgt.relname = 'app_users'
        AND src.relname = child_table
        AND a.attname = 'user_id'
        AND array_length(c.conkey, 1) = 1
        AND c.confdeltype = 'r'
    ) THEN
      CONTINUE;
    END IF;

    constraint_name := child_table || '_user_id_fkey';
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES public.app_users (user_id) ON DELETE RESTRICT',
      child_table,
      constraint_name
    );
  END LOOP;
END $$;
