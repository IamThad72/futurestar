import type { Client } from "pg";
import { bookAllowedForReading, classifyBook, displayBookName, normalizeBookKey } from "~/utils/bibleBooks.js";
import {
  DEFAULT_TRANSLATION,
  FALLBACK_TRANSLATION,
  normalizeTranslationCode,
  translationName,
  translationVersification,
} from "~/utils/bibleTranslations.js";
import { mapRangeForVersification, mapSegmentForVersification, psalmTitleOffset } from "~/utils/psalmNumbering.js";

export { normalizeBookKey };

export type BibleVerse = {
  book: string;
  chapter: number;
  verse: number;
  text: string;
};

export type BiblePassage = {
  citation: string;
  testament: "old" | "new";
  verses: BibleVerse[];
  text: string;
};

/** A reference in standard (Hebrew/English) numbering; mapped per translation at lookup time. */
export type PassageRef = {
  citation: string;
  testament: "old" | "new";
  book: string;
  chapter: number;
  start: number;
  end: number;
};

export type ScriptureOptions = {
  translation?: string;
  includeDeuterocanon?: boolean;
};

/**
 * Where the text comes from: the multi-translation tables (scripts/create_bible.sql)
 * or, before those exist or hold CPDV, the original bible_cpdv_* tables.
 */
type BibleSource = {
  kind: "multi" | "legacy";
  translation: string;
  versification: "standard" | "vulgate";
  books?: { book_id: number; name: string }[];
};

export const WEEKLY_SCRIPTURE_REF: PassageRef = {
  citation: "Psalm 46:10",
  testament: "old",
  book: "Psalms",
  chapter: 46,
  start: 10,
  end: 10,
};

export const MORNING_PRAYER_REFS: PassageRef[] = [
  WEEKLY_SCRIPTURE_REF,
  { citation: "Psalm 5:3–5", testament: "old", book: "Psalms", chapter: 5, start: 3, end: 5 },
  { citation: "Psalm 143:8", testament: "old", book: "Psalms", chapter: 143, start: 8, end: 8 },
  { citation: "Lamentations 3:22–23", testament: "old", book: "Lamentations", chapter: 3, start: 22, end: 23 },
  { citation: "Psalm 90:14", testament: "old", book: "Psalms", chapter: 90, start: 14, end: 14 },
  { citation: "Matthew 6:9–13", testament: "new", book: "Matthew", chapter: 6, start: 9, end: 13 },
  { citation: "Psalm 51:10–12", testament: "old", book: "Psalms", chapter: 51, start: 10, end: 12 },
  { citation: "Philippians 4:6–7", testament: "new", book: "Philippians", chapter: 4, start: 6, end: 7 },
  { citation: "Psalm 19:14", testament: "old", book: "Psalms", chapter: 19, start: 14, end: 14 },
  { citation: "Colossians 3:17", testament: "new", book: "Colossians", chapter: 3, start: 17, end: 17 },
  { citation: "Psalm 63:1", testament: "old", book: "Psalms", chapter: 63, start: 1, end: 1 },
  { citation: "Psalm 118:24", testament: "old", book: "Psalms", chapter: 118, start: 24, end: 24 },
  { citation: "Mark 1:35", testament: "new", book: "Mark", chapter: 1, start: 35, end: 35 },
];

function isReadableVerse(text: string) {
  const t = String(text || "").trim();
  if (t.length < 50) return false;
  const commas = (t.match(/,/g) || []).length;
  if (commas >= 4 && /,\s+[A-Z]/.test(t)) return false;
  if (/^(These are the|The sons of|And his|Now these)/i.test(t)) return false;
  return true;
}

export function dateSeed(iso: string, salt = 0) {
  let hash = salt >>> 0;
  for (const ch of String(iso || "")) {
    hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function calendarDayNumber(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
  if (!match) return 0;
  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000);
}

function positiveMod(value: number, length: number) {
  return ((value % length) + length) % length;
}

/** Indexes for one day. The window moves by a full set, so it does not reuse yesterday. */
export function morningPrayerIndexes(date: string, count = 3) {
  const length = MORNING_PRAYER_REFS.length;
  const size = Math.max(1, Math.min(count, length));
  const start = positiveMod(calendarDayNumber(date) * size, length);
  return Array.from({ length: size }, (_, offset) => (start + offset) % length);
}

function isMissingRelation(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code || "") : "";
  return code === "42P01" || code === "42703";
}

/** FROM/JOIN and WHERE for the source; `$1` is the translation for multi sources. */
function sourceSql(source: BibleSource) {
  if (source.kind === "multi") {
    return {
      from: `bible_verses v JOIN bible_books b ON b.translation = v.translation AND b.book_id = v.book_id`,
      where: `v.translation = $1`,
      params: [source.translation] as unknown[],
    };
  }
  return {
    from: `bible_cpdv_verses v JOIN bible_cpdv_books b ON b.book_id = v.book_id`,
    where: `TRUE`,
    params: [] as unknown[],
  };
}

async function multiTranslationsWithRows(client: Client, codes: string[]) {
  const result = await client.query<{ translation: string }>(
    `SELECT DISTINCT translation FROM bible_books WHERE translation = ANY($1::text[])`,
    [codes],
  );
  return new Set(result.rows.map((row) => row.translation));
}

async function legacyCpdvSeeded(client: Client) {
  try {
    const result = await client.query<{ seeded: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM bible_cpdv_verses) AS seeded`,
    );
    return Boolean(result.rows[0]?.seeded);
  } catch (error) {
    if (isMissingRelation(error)) return false;
    throw error;
  }
}

/**
 * Pick the text to read: the chosen translation, else CPDV in the new tables,
 * else the original CPDV tables. `fallback` is true when the chosen one is not seeded.
 */
export async function resolveBibleSource(client: Client, requested?: string) {
  const wanted = normalizeTranslationCode(requested) || DEFAULT_TRANSLATION;
  let available = new Set<string>();
  try {
    available = await multiTranslationsWithRows(client, [wanted, FALLBACK_TRANSLATION]);
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
  }
  if (available.has(wanted)) {
    return {
      requested: wanted,
      fallback: false,
      source: { kind: "multi", translation: wanted, versification: translationVersification(wanted) } as BibleSource,
    };
  }
  if (available.has(FALLBACK_TRANSLATION)) {
    return {
      requested: wanted,
      fallback: true,
      source: {
        kind: "multi",
        translation: FALLBACK_TRANSLATION,
        versification: translationVersification(FALLBACK_TRANSLATION),
      } as BibleSource,
    };
  }
  if (await legacyCpdvSeeded(client)) {
    return {
      requested: wanted,
      fallback: wanted !== FALLBACK_TRANSLATION,
      source: { kind: "legacy", translation: FALLBACK_TRANSLATION, versification: "vulgate" } as BibleSource,
    };
  }
  return { requested: wanted, fallback: false, source: null };
}

export async function getBibleCatalogStatus(client: Client, requested?: string) {
  const resolved = await resolveBibleSource(client, requested);
  const requestedName = translationName(resolved.requested);
  if (!resolved.source) {
    return {
      resolved,
      catalog: {
        seeded: false,
        translation: requestedName,
        translation_code: resolved.requested,
        requested_translation: resolved.requested,
        fallback: false,
        notice: "",
        message: "The Bible catalog is not seeded yet. Run the Bible seed to load Scripture.",
      },
    };
  }
  const code = resolved.source.translation;
  const name = translationName(code);
  return {
    resolved,
    catalog: {
      seeded: true,
      translation: name,
      translation_code: code,
      requested_translation: resolved.requested,
      fallback: resolved.fallback,
      notice: resolved.fallback
        ? `Showing the ${name} until the ${requestedName} is loaded (npm run seed:bible -- ${resolved.requested}).`
        : "",
      message: "",
    },
  };
}

async function loadBooks(client: Client, source: BibleSource) {
  if (source.books) return source.books;
  const result =
    source.kind === "multi"
      ? await client.query<{ book_id: number; name: string }>(
        "SELECT book_id, name FROM bible_books WHERE translation = $1 ORDER BY book_id",
        [source.translation],
      )
      : await client.query<{ book_id: number; name: string }>(
        "SELECT book_id, name FROM bible_cpdv_books ORDER BY book_id",
      );
  source.books = result.rows.map((row) => ({ book_id: Number(row.book_id), name: String(row.name) }));
  return source.books;
}

async function findBookId(client: Client, source: BibleSource, book: string) {
  const wanted = normalizeBookKey(book);
  const books = await loadBooks(client, source);
  return books.find((row) => normalizeBookKey(row.name) === wanted)?.book_id ?? null;
}

const PSALM_TITLE =
  /^(?:(?:For the (?:choirmaster|chief musician|director of music)|To the chief Musician)[^.]*\.\s*)?(?:A (?:Psalm|Song|Maskil|Miktam|Prayer)\b[^.]*\.\s*)/i;

/**
 * Standard-numbered texts (BSB, WEB, KJV) print a psalm's title inside verse 1.
 * Vulgate-numbered texts give the title its own verse, so nothing is removed there.
 */
export function stripPsalmTitle(book: string, chapter: number, verse: number, text: string, versification: string) {
  if (versification !== "standard" || book !== "Psalms" || verse !== 1 || psalmTitleOffset(chapter) === 0) return text;
  const stripped = text.replace(PSALM_TITLE, "").trim();
  return stripped || text;
}

function mapVerseRow(row: Record<string, unknown>): BibleVerse {
  return {
    book: String(row.book),
    chapter: Number(row.chapter),
    verse: Number(row.verse),
    text: String(row.text || "").trim(),
  };
}

export async function getPassage(client: Client, source: BibleSource, ref: PassageRef): Promise<BiblePassage | null> {
  const bookId = await findBookId(client, source, ref.book);
  if (!bookId) return null;
  const sql = sourceSql(source);
  const verses: BibleVerse[] = [];
  for (const segment of mapRangeForVersification(ref, source.versification)) {
    const base = sql.params.length;
    const result = await client.query(
      `SELECT b.name AS book, v.chapter, v.verse, v.text
       FROM ${sql.from}
       WHERE ${sql.where} AND v.book_id = $${base + 1} AND v.chapter = $${base + 2}
         AND v.verse BETWEEN $${base + 3} AND $${base + 4}
       ORDER BY v.verse`,
      [...sql.params, bookId, segment.chapter, segment.start, segment.end],
    );
    verses.push(
      ...result.rows
        .map(mapVerseRow)
        .map((verse) => ({
          ...verse,
          text: stripPsalmTitle(verse.book, verse.chapter, verse.verse, verse.text, source.versification),
        }))
        .filter((verse) => verse.text),
    );
  }
  if (!verses.length) return null;
  return {
    citation: ref.citation,
    testament: ref.testament,
    verses,
    text: verses.map((verse) => verse.text).join(" "),
  };
}

async function readingBookIds(
  client: Client,
  source: BibleSource,
  testament: "old" | "new",
  includeDeuterocanon: boolean,
) {
  const books = await loadBooks(client, source);
  return books
    .filter((row) => {
      if (!bookAllowedForReading(row.name, { includeDeuterocanon })) return false;
      return classifyBook(row.name).testament === testament;
    })
    .map((row) => row.book_id);
}

export async function getRandomPassage(
  client: Client,
  source: BibleSource,
  testament: "old" | "new",
  seed: string,
  includeDeuterocanon = false,
): Promise<BiblePassage | null> {
  const bookIds = await readingBookIds(client, source, testament, includeDeuterocanon);
  if (!bookIds.length) return null;
  const sql = sourceSql(source);
  const base = sql.params.length;
  // Catholic Bibles carry the Greek additions inside Esther (10:4–16:24) and Daniel
  // (3:24–90, 13–14). Leave them out when the deuterocanon is not wanted.
  const additions = includeDeuterocanon || source.versification !== "vulgate"
    ? ""
    : `AND NOT (b.name = 'Esther' AND (v.chapter > 10 OR (v.chapter = 10 AND v.verse > 3)))
       AND NOT (b.name = 'Daniel' AND (v.chapter > 12 OR (v.chapter = 3 AND v.verse BETWEEN 24 AND 90)))`;
  // Ordered by a hash of the reference (not the row id) so a re-seed keeps the same daily picks.
  const result = await client.query(
    `SELECT b.name AS book, v.chapter, v.verse, v.text
     FROM ${sql.from}
     WHERE ${sql.where}
       AND v.book_id = ANY($${base + 1}::int[])
       AND length(trim(v.text)) BETWEEN 50 AND 420
       AND v.text NOT ILIKE 'Unto the end%'
       AND v.text NOT ILIKE 'A Psalm of%'
       AND v.text NOT ILIKE 'In parts according%'
       ${additions}
     ORDER BY md5($${base + 2} || '-' || v.book_id::text || ':' || v.chapter::text || ':' || v.verse::text)
     LIMIT 12`,
    [...sql.params, bookIds, seed],
  );
  const row = result.rows.find((item) => isReadableVerse(String(item.text || ""))) || result.rows[0];
  if (!row) return null;
  const verse = mapVerseRow(row);
  return {
    citation: `${displayBookName(verse.book)} ${verse.chapter}:${verse.verse}`,
    testament,
    verses: [verse],
    text: verse.text,
  };
}

export async function listMorningPrayers(client: Client, date: string, count = 3, options: ScriptureOptions = {}) {
  const { resolved, catalog } = await getBibleCatalogStatus(client, options.translation);
  const source = resolved.source;
  if (!source) {
    return { catalog, weekly: null, prayers: [] as BiblePassage[] };
  }
  const weekly = await getPassage(client, source, WEEKLY_SCRIPTURE_REF);
  const todayIndexes = morningPrayerIndexes(date, count);
  const yesterday = new Date(`${date}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayIso = yesterday.toISOString().slice(0, 10);
  const blocked = new Set(morningPrayerIndexes(yesterdayIso, count));
  const ordered = [
    ...todayIndexes,
    ...MORNING_PRAYER_REFS.map((_, index) => index).filter(
      (index) => !todayIndexes.includes(index) && !blocked.has(index),
    ),
  ];
  const prayers: BiblePassage[] = [];
  for (const index of ordered) {
    if (prayers.length >= todayIndexes.length) break;
    const ref = MORNING_PRAYER_REFS[index];
    if (!ref) continue;
    const passage = await getPassage(client, source, ref);
    if (passage) prayers.push(passage);
  }
  return { catalog, weekly, prayers };
}

export async function listDailyScripture(client: Client, date: string, refresh = 0, options: ScriptureOptions = {}) {
  const { resolved, catalog } = await getBibleCatalogStatus(client, options.translation);
  const source = resolved.source;
  if (!source) {
    return { catalog, weekly: null, old_testament: null, new_testament: null };
  }
  const includeDeuterocanon = Boolean(options.includeDeuterocanon);
  const weekly = await getPassage(client, source, WEEKLY_SCRIPTURE_REF);
  const salt = refresh > 0 ? `refresh-${refresh}` : "daily";
  const oldTestament = await getRandomPassage(client, source, "old", `${date}-ot-${salt}`, includeDeuterocanon);
  const newTestament = await getRandomPassage(client, source, "new", `${date}-nt-${salt}`, includeDeuterocanon);
  return {
    catalog,
    weekly,
    old_testament: oldTestament,
    new_testament: newTestament,
  };
}

/** A plan reading in standard numbering (see utils/readingPlans.js). */
export type ReadingRef = {
  citation: string;
  book: string;
  segments: { chapter: number; start: number | null; end: number | null }[];
};

export type ReadingText = {
  citation: string;
  book: string;
  translation: string;
  verses: BibleVerse[];
};

/**
 * Text for one plan reading. Whole chapters keep every verse (psalm titles
 * included). With `includeDeuterocanon` false and a Catholic (vulgate) text,
 * the Greek parts of Esther and Daniel are left out.
 */
export async function getReadingText(
  client: Client,
  source: BibleSource,
  reading: ReadingRef,
  includeDeuterocanon = true,
): Promise<ReadingText | null> {
  const bookId = await findBookId(client, source, reading.book);
  if (!bookId) return null;
  const sql = sourceSql(source);
  const base = sql.params.length;
  const additions = includeDeuterocanon || source.versification !== "vulgate"
    ? ""
    : `AND NOT (b.name = 'Esther' AND (v.chapter > 10 OR (v.chapter = 10 AND v.verse > 3)))
       AND NOT (b.name = 'Daniel' AND (v.chapter > 12 OR (v.chapter = 3 AND v.verse BETWEEN 24 AND 90)))`;
  const verses: BibleVerse[] = [];
  for (const segment of reading.segments) {
    const mapped = mapSegmentForVersification({ book: reading.book, ...segment }, source.versification) as {
      chapter: number;
      start: number;
      end: number | null;
    }[];
    for (const part of mapped) {
      const result = await client.query(
        `SELECT b.name AS book, v.chapter, v.verse, v.text
         FROM ${sql.from}
         WHERE ${sql.where} AND v.book_id = $${base + 1} AND v.chapter = $${base + 2}
           AND v.verse >= $${base + 3} AND ($${base + 4}::int IS NULL OR v.verse <= $${base + 4}::int)
           ${additions}
         ORDER BY v.verse`,
        [...sql.params, bookId, part.chapter, part.start ?? 1, part.end ?? null],
      );
      verses.push(...result.rows.map(mapVerseRow).filter((verse) => verse.text));
    }
  }
  if (!verses.length) return null;
  return { citation: reading.citation, book: reading.book, translation: source.translation, verses };
}

/**
 * Like getReadingText, but when the chosen translation lacks the book or the
 * passage (for example Tobit in the BSB), read it from the CPDV instead.
 */
export async function getReadingTextWithFallback(
  client: Client,
  source: BibleSource,
  reading: ReadingRef,
  includeDeuterocanon: boolean,
  fallbackSource: () => Promise<BibleSource | null>,
) {
  const text = await getReadingText(client, source, reading, includeDeuterocanon);
  if (text) return { ...text, fallback: false };
  if (source.translation === FALLBACK_TRANSLATION) return null;
  const other = await fallbackSource();
  if (!other) return null;
  const fallbackText = await getReadingText(client, other, reading, includeDeuterocanon);
  return fallbackText ? { ...fallbackText, fallback: true } : null;
}

export type { BibleSource };
