-- Allow weighted (and optional stick) cache rows for the full OSS equipment cache.
ALTER TABLE exercise_catalog DROP CONSTRAINT IF EXISTS exercise_catalog_equipment_key_check;

ALTER TABLE exercise_catalog
  ADD CONSTRAINT exercise_catalog_equipment_key_check CHECK (
    equipment_key IS NULL
    OR equipment_key IN (
      'body',
      'dumbbell',
      'kettlebell',
      'machine',
      'rope',
      'outdoor',
      'roller',
      'assisted',
      'ball',
      'weighted',
      'stick'
    )
  );
