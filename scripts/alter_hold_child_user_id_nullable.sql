-- Holdings and service history of a private account are kept with that account
-- for 90 days. user_id has to be nullable so the row can be detached before
-- DELETE FROM app_users, which would otherwise cascade these rows away.
-- Safe to run more than once. Does not delete rows.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'investment_positions'
      AND column_name = 'user_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.investment_positions ALTER COLUMN user_id DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vehicle_service_records'
      AND column_name = 'user_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.vehicle_service_records ALTER COLUMN user_id DROP NOT NULL';
  END IF;
END $$;
