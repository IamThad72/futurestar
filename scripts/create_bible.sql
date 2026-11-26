-- Multi-translation Bible catalog for Spiritual (BSB, WEB, KJV, CPDV).
-- Global read-only reference text. Do not add group_id or user_id.
-- Idempotent: safe to run more than once. Does not drop or delete anything.
--
-- Run after scripts/create_bible_cpdv.sql (already in place). The older
-- bible_cpdv_books / bible_cpdv_verses tables are left as they are; the app
-- reads them only when these new tables have no CPDV rows.
--
-- Load text with the seed script (it downloads the public-domain files):
--   npm run seed:bible -- BSB      (default translation for new accounts)
--   npm run seed:bible -- WEB
--   npm run seed:bible -- KJV
--   npm run seed:bible -- CPDV     (optional; this script already copies existing CPDV rows)
--   npm run seed:bible -- all
--
-- Verse numbers are stored exactly as each translation numbers them. CPDV uses
-- Vulgate psalm numbering (versification = 'vulgate'); the app maps standard
-- references such as Psalm 46:10 to CPDV 45:11 in utils/psalmNumbering.js.
--
-- canon: 'protestant' = the 66 books every tradition shares,
--        'deuterocanon' = Tobit, Judith, Wisdom, Sirach, Baruch, 1–2 Maccabees,
--        'extra' = books no daily reading draws from (Prayer of Manasses, Esdras, Psalm 151, Laodiceans, …).

CREATE TABLE IF NOT EXISTS bible_translations (
    translation TEXT PRIMARY KEY,
    title TEXT,
    license TEXT
);

ALTER TABLE bible_translations ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE bible_translations ADD COLUMN IF NOT EXISTS versification TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE bible_translations ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE bible_translations ADD COLUMN IF NOT EXISTS seeded_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS bible_books (
    translation TEXT NOT NULL REFERENCES bible_translations(translation) ON DELETE CASCADE,
    book_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    book_key TEXT NOT NULL,
    testament TEXT NOT NULL CHECK (testament IN ('old', 'new')),
    canon TEXT NOT NULL CHECK (canon IN ('protestant', 'deuterocanon', 'extra')),
    PRIMARY KEY (translation, book_id),
    UNIQUE (translation, name)
);

CREATE TABLE IF NOT EXISTS bible_verses (
    verse_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    translation TEXT NOT NULL,
    book_id INTEGER NOT NULL,
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    text TEXT NOT NULL,
    UNIQUE (translation, book_id, chapter, verse),
    FOREIGN KEY (translation, book_id) REFERENCES bible_books(translation, book_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bible_verses_translation_book_chapter
    ON bible_verses (translation, book_id, chapter);

-- Copy the CPDV text already loaded by seed:cpdv into the new tables, once.
DO $$
BEGIN
    IF to_regclass('public.bible_cpdv_books') IS NOT NULL
       AND to_regclass('public.bible_cpdv_verses') IS NOT NULL
       AND EXISTS (SELECT 1 FROM bible_cpdv_verses)
       AND NOT EXISTS (SELECT 1 FROM bible_books WHERE translation = 'CPDV') THEN

        INSERT INTO bible_translations (translation, title, license)
        VALUES ('CPDV', 'CPDV: Catholic Public Domain Version', 'Public Domain')
        ON CONFLICT (translation) DO NOTHING;

        UPDATE bible_translations
        SET name = 'Catholic Public Domain Version',
            versification = 'vulgate',
            source_url = COALESCE(source_url, 'https://github.com/scrollmapper/bible_databases'),
            seeded_at = COALESCE(seeded_at, NOW())
        WHERE translation = 'CPDV';

        INSERT INTO bible_books (translation, book_id, name, book_key, testament, canon)
        SELECT
            'CPDV',
            k.book_id,
            k.name,
            k.book_key,
            CASE WHEN k.book_key IN (
                'matthew', 'mark', 'luke', 'john', 'acts', 'romans', '1corinthians', '2corinthians',
                'galatians', 'ephesians', 'philippians', 'colossians', '1thessalonians', '2thessalonians',
                '1timothy', '2timothy', 'titus', 'philemon', 'hebrews', 'james', '1peter', '2peter',
                '1john', '2john', '3john', 'jude', 'revelationofjohn', 'laodiceans'
            ) THEN 'new' ELSE 'old' END,
            CASE
                WHEN k.book_key IN ('prayerofmanasses', '1esdras', '2esdras', 'additionalpsalm', 'laodiceans') THEN 'extra'
                WHEN k.book_key IN ('tobit', 'judith', 'wisdom', 'sirach', 'baruch', '1maccabees', '2maccabees') THEN 'deuterocanon'
                ELSE 'protestant'
            END
        FROM (
            SELECT
                b.book_id,
                b.name,
                regexp_replace(
                    lower(regexp_replace(regexp_replace(regexp_replace(b.name, '^III ', '3 '), '^II ', '2 '), '^I ', '1 ')),
                    '[^a-z0-9]', '', 'g'
                ) AS book_key
            FROM bible_cpdv_books b
        ) k
        ON CONFLICT (translation, book_id) DO NOTHING;

        INSERT INTO bible_verses (translation, book_id, chapter, verse, text)
        SELECT 'CPDV', v.book_id, v.chapter, v.verse, v.text
        FROM bible_cpdv_verses v
        ORDER BY v.verse_id
        ON CONFLICT (translation, book_id, chapter, verse) DO NOTHING;
    END IF;
END $$;
