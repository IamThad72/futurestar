-- User-private Physical workouts. Scope by user_id only. Never add group_id.
-- exercise_catalog stays a global read-only reference; workout lines store FKs.

CREATE TABLE IF NOT EXISTS workouts (
    workout_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workouts_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_user_name
    ON workouts (user_id, lower(trim(name)));
CREATE INDEX IF NOT EXISTS idx_workouts_user_updated
    ON workouts (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS workout_exercises (
    workout_exercise_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workout_id INTEGER NOT NULL REFERENCES workouts(workout_id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES exercise_catalog(exercise_id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    sets INTEGER,
    reps INTEGER,
    weight NUMERIC(10, 2),
    weight_unit TEXT NOT NULL DEFAULT 'lb',
    rest_seconds INTEGER,
    duration_seconds INTEGER,
    notes TEXT,
    CONSTRAINT workout_exercises_weight_unit_check CHECK (weight_unit IN ('lb', 'kg')),
    CONSTRAINT workout_exercises_sort_order_check CHECK (sort_order >= 0),
    CONSTRAINT workout_exercises_sets_check CHECK (sets IS NULL OR sets >= 0),
    CONSTRAINT workout_exercises_reps_check CHECK (reps IS NULL OR reps >= 0),
    CONSTRAINT workout_exercises_weight_check CHECK (weight IS NULL OR weight >= 0),
    CONSTRAINT workout_exercises_rest_check CHECK (rest_seconds IS NULL OR rest_seconds >= 0),
    CONSTRAINT workout_exercises_duration_check CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout
    ON workout_exercises (workout_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_exercise
    ON workout_exercises (exercise_id);
