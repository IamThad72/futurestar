-- Inadiutorium Church Calendar catalog for Spiritual.
-- Global read-only reference. Do not add group_id.
-- Source: http://calapi.inadiutorium.cz/api-doc (HTTP API v0).
-- English General Roman Calendar (`/api/v0/en/calendars/default`).
-- The year path returns lectionary setup, not days; days are loaded month-by-month.

CREATE TABLE IF NOT EXISTS liturgical_calendars (
    calendar_id TEXT PRIMARY KEY,
    locale TEXT NOT NULL,
    calendar_key TEXT NOT NULL,
    title TEXT,
    language TEXT,
    system_promulgated INTEGER,
    system_effective_since INTEGER,
    system_desc TEXT,
    source_url TEXT NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (locale, calendar_key)
);

CREATE TABLE IF NOT EXISTS liturgical_years (
    calendar_id TEXT NOT NULL REFERENCES liturgical_calendars (calendar_id) ON DELETE CASCADE,
    civil_year INTEGER NOT NULL,
    lectionary TEXT,
    ferial_lectionary INTEGER,
    source_url TEXT NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (calendar_id, civil_year)
);

-- civil_year on liturgical_years is the API year argument: it describes the
-- liturgical year that begins with Advent of that civil year (through the
-- following Advent). Ordinary Time before Advent uses civil_year - 1.

CREATE TABLE IF NOT EXISTS liturgical_days (
    calendar_id TEXT NOT NULL REFERENCES liturgical_calendars (calendar_id) ON DELETE CASCADE,
    day_date DATE NOT NULL,
    season TEXT NOT NULL,
    season_week INTEGER NOT NULL,
    weekday TEXT NOT NULL,
    source_url TEXT NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (calendar_id, day_date)
);

CREATE INDEX IF NOT EXISTS idx_liturgical_days_season
    ON liturgical_days (calendar_id, season, day_date);

CREATE INDEX IF NOT EXISTS idx_liturgical_days_weekday
    ON liturgical_days (calendar_id, weekday, day_date);

CREATE TABLE IF NOT EXISTS liturgical_celebrations (
    celebration_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    calendar_id TEXT NOT NULL,
    day_date DATE NOT NULL,
    sort_order INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    rank TEXT,
    rank_num NUMERIC(8, 4),
    color TEXT,
    celebration_type TEXT,
    FOREIGN KEY (calendar_id, day_date)
        REFERENCES liturgical_days (calendar_id, day_date) ON DELETE CASCADE,
    UNIQUE (calendar_id, day_date, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_liturgical_celebrations_day
    ON liturgical_celebrations (calendar_id, day_date, sort_order);

CREATE INDEX IF NOT EXISTS idx_liturgical_celebrations_title_lower
    ON liturgical_celebrations (lower(title));
