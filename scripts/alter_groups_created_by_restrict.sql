-- Stop a household from vanishing when its creator deletes their account.
-- Account deletion sets created_by to the next owner before it deletes the
-- user. RESTRICT makes a missed handoff fail that deletion instead of
-- cascading the group away. Safe to run more than once. Does not delete rows.
-- No-op when public.groups is not there yet (the base groups table is older
-- than scripts/run-migrations.mjs).

DO $$
DECLARE
  constraint_name text;
BEGIN
  IF to_regclass('public.groups') IS NULL THEN
    RAISE NOTICE 'groups is missing; created_by delete rule was not changed.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'groups'
      AND column_name = 'created_by'
  ) THEN
    RAISE NOTICE 'groups.created_by is missing; delete rule was not changed.';
    RETURN;
  END IF;

  SELECT c.conname
    INTO constraint_name
  FROM pg_constraint c
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid
   AND a.attnum = ANY (c.conkey)
  WHERE c.contype = 'f'
    AND c.conrelid = 'public.groups'::regclass
    AND c.confrelid = 'public.app_users'::regclass
    AND a.attname = 'created_by'
  LIMIT 1;

  IF constraint_name IS NOT NULL AND EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = constraint_name
      AND c.conrelid = 'public.groups'::regclass
      AND c.confdeltype = 'r'
  ) THEN
    RETURN;
  END IF;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE groups DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE groups
    ADD CONSTRAINT groups_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES app_users(user_id) ON DELETE RESTRICT;
END $$;
