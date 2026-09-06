-- Allow kettlebells and no-weight bodyweight pulls; rename home-based cache rows.
ALTER TABLE exercise_catalog DROP CONSTRAINT IF EXISTS exercise_catalog_equipment_key_check;

UPDATE exercise_catalog
SET equipment_key = 'none'
WHERE equipment_key = 'home';
