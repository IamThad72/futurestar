-- Allow cardio-machine and jump-rope rows for Endurance Training.
-- Do not re-add a narrower CHECK; the latest equipment_key constraint lives in
-- alter_exercise_catalog_weighted_equipment.sql.
ALTER TABLE exercise_catalog DROP CONSTRAINT IF EXISTS exercise_catalog_equipment_key_check;
