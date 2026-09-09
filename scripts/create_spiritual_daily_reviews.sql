-- Private daily spiritual review (morning intention + evening examen).
-- Scoped by user_id only. Never add group_id.

CREATE TABLE IF NOT EXISTS spiritual_daily_reviews (
    review_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    review_on DATE NOT NULL,
    love_person TEXT,
    virtue TEXT,
    faithful_act TEXT,
    surrender TEXT,
    grateful TEXT,
    presence TEXT,
    troubled TEXT,
    integrity TEXT,
    shortfall TEXT,
    amends TEXT,
    tomorrow TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT spiritual_daily_reviews_user_day UNIQUE (user_id, review_on)
);

CREATE INDEX IF NOT EXISTS idx_spiritual_daily_reviews_user_day
    ON spiritual_daily_reviews (user_id, review_on DESC);
