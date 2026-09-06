-- Cached ExerciseDB catalog for Physical Health (global, not per-user).
CREATE TABLE IF NOT EXISTS exercise_catalog (
    exercise_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    gif_url TEXT,
    overview TEXT,
    body_parts JSONB NOT NULL DEFAULT '[]'::jsonb,
    target_muscles JSONB NOT NULL DEFAULT '[]'::jsonb,
    secondary_muscles JSONB NOT NULL DEFAULT '[]'::jsonb,
    equipments JSONB NOT NULL DEFAULT '[]'::jsonb,
    instructions JSONB NOT NULL DEFAULT '[]'::jsonb,
    exercise_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    difficulty TEXT,
    equipment_key TEXT,
    source TEXT NOT NULL DEFAULT 'oss_v1',
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT exercise_catalog_equipment_key_check CHECK (
      equipment_key IS NULL OR equipment_key IN ('body', 'dumbbell', 'kettlebell')
    )
);

CREATE INDEX IF NOT EXISTS idx_exercise_catalog_equipment_key
  ON exercise_catalog (equipment_key);
CREATE INDEX IF NOT EXISTS idx_exercise_catalog_name_lower
  ON exercise_catalog (lower(name));
CREATE INDEX IF NOT EXISTS idx_exercise_catalog_fetched
  ON exercise_catalog (fetched_at);

CREATE TABLE IF NOT EXISTS exercise_catalog_sync (
    equipment_name TEXT PRIMARY KEY,
    next_cursor TEXT,
    complete BOOLEAN NOT NULL DEFAULT FALSE,
    item_count INTEGER NOT NULL DEFAULT 0,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
