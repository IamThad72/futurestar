-- CPDV (Catholic Public Domain Version) catalog for Spiritual.
-- Global read-only reference text. Do not add group_id.
-- Source: https://github.com/scrollmapper/bible_databases
-- Translation: Catholic Public Domain Version (CPDV). Public domain.
-- Schema follows scrollmapper (translations + books + verses), prefixed bible_.

CREATE TABLE IF NOT EXISTS bible_translations (
    translation TEXT PRIMARY KEY,
    title TEXT,
    license TEXT
);

CREATE TABLE IF NOT EXISTS bible_cpdv_books (
    book_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bible_cpdv_verses (
    verse_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    book_id INTEGER NOT NULL REFERENCES bible_cpdv_books(book_id) ON DELETE CASCADE,
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    text TEXT NOT NULL,
    UNIQUE (book_id, chapter, verse)
);

CREATE INDEX IF NOT EXISTS idx_bible_cpdv_verses_book_chapter
    ON bible_cpdv_verses (book_id, chapter);
