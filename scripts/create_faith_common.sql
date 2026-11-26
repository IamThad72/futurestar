-- Faith practices: reading plans, prayer list and weekly worship check-in.
-- Private rows scoped by user_id only (like spiritual_daily_reviews). Never add group_id.
-- Idempotent: safe to run more than once. Does not drop or delete anything.
--
-- The plans themselves (Bible in a Year, Gospels in 30 days, Psalms and
-- Proverbs, Advent, Lent, Deuterocanon) are defined in utils/readingPlans.js,
-- so there is nothing to seed. These tables hold who started which plan and
-- which days are done or skipped.

CREATE TABLE IF NOT EXISTS user_reading_plans (
    user_plan_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    plan_key TEXT NOT NULL,
    start_on DATE NOT NULL,
    -- Fixed when the plan starts: true in Catholic mode (and for the
    -- Deuterocanon plan), so a plan's days never change mid-way.
    include_deuterocanon BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'stopped')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS user_reading_plans_user_idx ON user_reading_plans (user_id, status);

-- One running copy of each plan per person.
CREATE UNIQUE INDEX IF NOT EXISTS user_reading_plans_one_active
    ON user_reading_plans (user_id, plan_key) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS user_reading_progress (
    user_plan_id INTEGER NOT NULL REFERENCES user_reading_plans(user_plan_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL CHECK (day_number > 0),
    status TEXT NOT NULL CHECK (status IN ('done', 'skipped')),
    marked_on DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_plan_id, day_number)
);

CREATE INDEX IF NOT EXISTS user_reading_progress_user_idx ON user_reading_progress (user_id);

CREATE TABLE IF NOT EXISTS prayer_requests (
    prayer_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
    notes TEXT,
    person TEXT,
    category TEXT,
    created_on DATE NOT NULL DEFAULT CURRENT_DATE,
    answered_on DATE,
    answer_note TEXT,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prayer_requests_user_idx ON prayer_requests (user_id, archived_at, answered_on);

-- week_start is the Sunday that begins the week (weeks run Sunday to Saturday).
CREATE TABLE IF NOT EXISTS worship_checkins (
    checkin_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    attendance TEXT NOT NULL CHECK (attendance IN ('in_person', 'online', 'not_this_week')),
    church_name TEXT,
    sermon_passage TEXT,
    notes TEXT,
    takeaway TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, week_start)
);
