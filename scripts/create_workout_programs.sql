-- User-private workout programs, and a join table so one workout
-- can belong to several programs.
-- Scope by user_id only. Never add group_id.
-- Mirrors workouts: no Postgres RLS. Privacy is enforced in the API
-- with requirePrivateUserId and privateUserClause.

CREATE TABLE IF NOT EXISTS workout_programs (
    program_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workout_programs_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT workout_programs_sort_order_check CHECK (sort_order >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_programs_user_name
    ON workout_programs (user_id, lower(trim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_programs_user_id
    ON workout_programs (user_id, program_id);
CREATE INDEX IF NOT EXISTS idx_workout_programs_user_sort
    ON workout_programs (user_id, sort_order, program_id);

-- Same-user uniqueness used by the composite FK from the join table.
CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_user_id
    ON workouts (user_id, workout_id);

CREATE TABLE IF NOT EXISTS workout_program_items (
    program_item_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    program_id INTEGER NOT NULL REFERENCES workout_programs(program_id) ON DELETE CASCADE,
    workout_id INTEGER NOT NULL REFERENCES workouts(workout_id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workout_program_items_program_workout_unique UNIQUE (program_id, workout_id),
    CONSTRAINT workout_program_items_sort_order_check CHECK (sort_order >= 0)
);

-- A link cannot point at another user's program or workout.
DO $$
BEGIN
    ALTER TABLE workout_program_items
        ADD CONSTRAINT workout_program_items_program_same_user_fk
        FOREIGN KEY (user_id, program_id)
        REFERENCES workout_programs (user_id, program_id)
        ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE workout_program_items
        ADD CONSTRAINT workout_program_items_workout_same_user_fk
        FOREIGN KEY (user_id, workout_id)
        REFERENCES workouts (user_id, workout_id)
        ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_workout_program_items_program
    ON workout_program_items (program_id, sort_order, workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_program_items_workout
    ON workout_program_items (workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_program_items_user
    ON workout_program_items (user_id);
