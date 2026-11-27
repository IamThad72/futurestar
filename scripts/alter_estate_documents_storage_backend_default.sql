-- New estate document rows default to Supabase Storage.
-- Existing rows keep the storage_backend they already have.
-- Safe to run more than once. Does not update or delete rows.
-- No-op when public.estate_documents is missing, when storage_backend
-- is missing, or when the default is already supabase.
-- Not applied to production.

DO $$
BEGIN
  IF to_regclass('public.estate_documents') IS NULL THEN
    RAISE NOTICE 'estate_documents is missing; storage_backend default was not changed.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'estate_documents'
      AND column_name = 'storage_backend'
  ) THEN
    RAISE NOTICE 'estate_documents.storage_backend is missing; default was not changed.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'estate_documents'
      AND column_name = 'storage_backend'
      AND column_default IN ('''supabase''::text', '''supabase''')
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE estate_documents ALTER COLUMN storage_backend SET DEFAULT 'supabase';
END $$;
