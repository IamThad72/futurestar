-- User-private Workout Exercise Journal (completed sessions).
-- Distinct from workout PLAN tables (workouts / workout_exercises).
-- Scope by user_id only. Never add group_id.
-- Exercise identity is snapshotted so catalog edits do not rewrite history.

CREATE TABLE IF NOT EXISTS workout_journal_sessions (
    session_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    workout_id INTEGER REFERENCES workouts(workout_id) ON DELETE SET NULL,
    workout_name TEXT,
    name TEXT,
    notes TEXT,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_journal_sessions_user_performed
    ON workout_journal_sessions (user_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_journal_sessions_workout
    ON workout_journal_sessions (workout_id);

CREATE TABLE IF NOT EXISTS workout_journal_exercises (
    journal_exercise_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES workout_journal_sessions(session_id) ON DELETE CASCADE,
    exercise_id TEXT,
    exercise_name TEXT NOT NULL,
    equipment_key TEXT,
    gif_url TEXT,
    log_mode TEXT NOT NULL DEFAULT 'reps',
    sort_order INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    CONSTRAINT workout_journal_exercises_name_not_blank CHECK (length(trim(exercise_name)) > 0),
    CONSTRAINT workout_journal_exercises_log_mode_check CHECK (log_mode IN ('reps', 'duration')),
    CONSTRAINT workout_journal_exercises_sort_order_check CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_workout_journal_exercises_session
    ON workout_journal_exercises (session_id, sort_order);

CREATE TABLE IF NOT EXISTS workout_journal_sets (
    journal_set_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    journal_exercise_id INTEGER NOT NULL REFERENCES workout_journal_exercises(journal_exercise_id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    reps INTEGER,
    weight NUMERIC(10, 2),
    weight_unit TEXT NOT NULL DEFAULT 'lb',
    duration_seconds INTEGER,
    rest_seconds INTEGER,
    notes TEXT,
    CONSTRAINT workout_journal_sets_weight_unit_check CHECK (weight_unit IN ('lb', 'kg')),
    CONSTRAINT workout_journal_sets_sort_order_check CHECK (sort_order >= 0),
    CONSTRAINT workout_journal_sets_reps_check CHECK (reps IS NULL OR reps >= 0),
    CONSTRAINT workout_journal_sets_weight_check CHECK (weight IS NULL OR weight >= 0),
    CONSTRAINT workout_journal_sets_duration_check CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    CONSTRAINT workout_journal_sets_rest_check CHECK (rest_seconds IS NULL OR rest_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS idx_workout_journal_sets_exercise
    ON workout_journal_sets (journal_exercise_id, sort_order);
