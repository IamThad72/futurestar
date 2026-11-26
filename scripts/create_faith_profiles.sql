-- Faith tradition setting for Spiritual: one private row per user.
-- Scoped by user_id only (like spiritual_daily_reviews). Never add group_id.
-- Idempotent: safe to run more than once. Does not drop or delete anything.
--
-- tradition:     christian (non-denominational, the default for new accounts),
--                protestant, catholic or orthodox.
-- translation:   BSB, WEB, KJV or CPDV (see utils/bibleTranslations.js).
-- show_calendar: false hides the church calendar on the Faith home and Today.
--
-- Accounts with no row see a one-time prompt on the Faith home and use the
-- Christian defaults (BSB, church-year calendar, "Evening Reflection").
-- Catholic mode is the original FutureStar experience: CPDV, the General Roman
-- Calendar with saints' days, "Evening Examen" and the Catechism virtue wording.
--
-- Existing accounts: the first time this script runs (when the table is
-- created), every account that already exists, except the demo account, is
-- set to Catholic + CPDV so nothing changes for the people already using the
-- app, including the owner. Accounts created later are not touched, even if
-- this script runs again.
--
-- To set one account by email instead (for example if the table already existed):
-- INSERT INTO user_faith_profiles (user_id, tradition, translation, show_calendar)
-- SELECT user_id, 'catholic', 'CPDV', TRUE FROM app_users WHERE lower(email) = lower('YOUR_EMAIL_HERE')
-- ON CONFLICT (user_id) DO UPDATE SET
--   tradition = EXCLUDED.tradition,
--   translation = EXCLUDED.translation,
--   show_calendar = EXCLUDED.show_calendar,
--   updated_at = NOW();

DO $$
DECLARE
    is_new BOOLEAN := to_regclass('public.user_faith_profiles') IS NULL;
BEGIN
    CREATE TABLE IF NOT EXISTS user_faith_profiles (
        user_id INTEGER PRIMARY KEY REFERENCES app_users(user_id) ON DELETE CASCADE,
        tradition TEXT NOT NULL DEFAULT 'christian'
            CHECK (tradition IN ('christian', 'protestant', 'catholic', 'orthodox')),
        translation TEXT NOT NULL DEFAULT 'BSB'
            CHECK (translation IN ('BSB', 'WEB', 'KJV', 'CPDV')),
        show_calendar BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    IF is_new THEN
        INSERT INTO user_faith_profiles (user_id, tradition, translation, show_calendar)
        SELECT u.user_id, 'catholic', 'CPDV', TRUE
        FROM app_users u
        WHERE lower(coalesce(u.email, '')) <> 'demo@futurestar.app'
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
END $$;
