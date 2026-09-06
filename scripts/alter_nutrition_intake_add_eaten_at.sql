-- Time of day for each logged serving (eaten_at timestamptz).
-- Existing rows are backfilled from created_at (when they were logged),
-- which is the least-surprising time we already have.

ALTER TABLE nutrition_intake_entries
    ADD COLUMN IF NOT EXISTS eaten_at TIMESTAMPTZ;

UPDATE nutrition_intake_entries
SET eaten_at = created_at
WHERE eaten_at IS NULL;

ALTER TABLE nutrition_intake_entries
    ALTER COLUMN eaten_at SET DEFAULT NOW();

ALTER TABLE nutrition_intake_entries
    ALTER COLUMN eaten_at SET NOT NULL;
