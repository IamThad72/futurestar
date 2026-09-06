-- Merge band and bodyweight cache rows into one filter category.
ALTER TABLE exercise_catalog DROP CONSTRAINT IF EXISTS exercise_catalog_equipment_key_check;

UPDATE exercise_catalog
SET equipment_key = 'body'
WHERE equipment_key IN ('none', 'home', 'resistance');
