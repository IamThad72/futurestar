import type { Client } from "pg";

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

type PassageRef = {
  citation: string;
  testament: "old" | "new";
  book: string;
  chapter: number;
  start: number;
  end: number;
};

const NT_BOOKS = new Set([
  "matthew",
  "mark",
  "luke",
  "john",
  "acts",
  "romans",
  "1corinthians",
  "2corinthians",
  "galatians",
  "ephesians",
  "philippians",
  "colossians",
  "1thessalonians",
  "2thessalonians",
  "1timothy",
  "2timothy",
  "titus",
  "philemon",
  "hebrews",
  "james",
  "1peter",
  "2peter",
  "1john",
  "2john",
  "3john",
  "jude",
  "revelation",
  "revelationofjohn",
]);

const EXTRA_BOOKS = new Set([
  "prayerofmanasses",
  "1esdras",
  "2esdras",
  "additionalpsalm",
  "laodiceans",
]);

const BOOK_ALIASES: Record<string, string> = {
  psalm: "psalms",
  revelation: "revelationofjohn",
  apocalypse: "revelationofjohn",
  songofsongs: "songofsolomon",
  songofsolomon: "songofsolomon",
  canticleofcanticles: "songofsolomon",
};

export const WEEKLY_SCRIPTURE_REF: PassageRef = {
  citation: "Psalm 46:10",
  testament: "old",
  book: "Psalms",
  chapter: 45,
  start: 11,
  end: 11,
};

export const MORNING_PRAYER_REFS: PassageRef[] = [
  WEEKLY_SCRIPTURE_REF,
  { citation: "Psalm 5:3–5", testament: "old", book: "Psalms", chapter: 5, start: 3, end: 5 },
  { citation: "Psalm 143:8", testament: "old", book: "Psalms", chapter: 142, start: 8, end: 8 },
  { citation: "Lamentations 3:22–23", testament: "old", book: "Lamentations", chapter: 3, start: 22, end: 23 },
  { citation: "Psalm 90:14", testament: "old", book: "Psalms", chapter: 89, start: 14, end: 14 },
  { citation: "Matthew 6:9–13", testament: "new", book: "Matthew", chapter: 6, start: 9, end: 13 },
  { citation: "Psalm 51:10–12", testament: "old", book: "Psalms", chapter: 50, start: 12, end: 14 },
  { citation: "Philippians 4:6–7", testament: "new", book: "Philippians", chapter: 4, start: 6, end: 7 },
  { citation: "Psalm 19:14", testament: "old", book: "Psalms", chapter: 18, start: 15, end: 15 },
  { citation: "Colossians 3:17", testament: "new", book: "Colossians", chapter: 3, start: 17, end: 17 },
  { citation: "Psalm 63:1", testament: "old", book: "Psalms", chapter: 62, start: 2, end: 2 },
  { citation: "Psalm 118:24", testament: "old", book: "Psalms", chapter: 117, start: 24, end: 24 },
  { citation: "Mark 1:35", testament: "new", book: "Mark", chapter: 1, start: 35, end: 35 },
];

export function normalizeBookKey(name: string) {
  let key = String(name || "")
    .toLowerCase()
    .replace(/^(the)\s+/, "")
    .replace(/\b(first|1st)\b/g, "1")
    .replace(/\b(second|2nd)\b/g, "2")
    .replace(/\b(third|3rd)\b/g, "3")
    .replace(/\biii\b/g, "3")
    .replace(/\bii\b/g, "2")
    .replace(/\bi\b/g, "1")
    .replace(/[^a-z0-9]/g, "");
  return BOOK_ALIASES[key] || key;
}

function isNewTestamentName(name: string) {
  return NT_BOOKS.has(normalizeBookKey(name));
}

function isExtraBookName(name: string) {
  return EXTRA_BOOKS.has(normalizeBookKey(name));
}

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

function passageFromVerses(ref: PassageRef, verses: BibleVerse[]): BiblePassage | null {
  if (!verses.length) return null;
  return {
    citation: ref.citation,
    testament: ref.testament,
    verses,
    text: verses.map((verse) => verse.text).join(" "),
  };
}

async function loadBooks(client: Client) {
  const result = await client.query<{ book_id: number; name: string }>(
    "SELECT book_id, name FROM bible_cpdv_books ORDER BY book_id",
  );
  return result.rows;
}

async function findBookId(client: Client, book: string) {
  const wanted = normalizeBookKey(book);
  const books = await loadBooks(client);
  const match = books.find((row) => normalizeBookKey(row.name) === wanted);
  return match?.book_id ?? null;
}

export async function getCpdvCatalogStatus(client: Client) {
  const result = await client.query<{ books: number; verses: number }>(
    `SELECT
       (SELECT COUNT(*)::int FROM bible_cpdv_books) AS books,
       (SELECT COUNT(*)::int FROM bible_cpdv_verses) AS verses`,
  );
  const books = Number(result.rows[0]?.books || 0);
  const verses = Number(result.rows[0]?.verses || 0);
  return {
    seeded: books > 0 && verses > 0,
    books,
    verses,
    translation: "Catholic Public Domain Version",
    message:
      books > 0 && verses > 0
        ? ""
        : "The Bible catalog is not seeded yet. Run the CPDV seed to load Scripture.",
  };
}

export async function getPassage(client: Client, ref: PassageRef): Promise<BiblePassage | null> {
  const bookId = await findBookId(client, ref.book);
  if (!bookId) return null;
  const result = await client.query(
    `SELECT b.name AS book, v.chapter, v.verse, v.text
     FROM bible_cpdv_verses v
     JOIN bible_cpdv_books b ON b.book_id = v.book_id
     WHERE v.book_id = $1 AND v.chapter = $2 AND v.verse BETWEEN $3 AND $4
     ORDER BY v.verse`,
    [bookId, ref.chapter, ref.start, ref.end],
  );
  const verses = result.rows.map((row) => ({
    book: String(row.book),
    chapter: Number(row.chapter),
    verse: Number(row.verse),
    text: String(row.text || "").trim(),
  }));
  return passageFromVerses(ref, verses.filter((verse) => verse.text));
}

export async function listMorningPrayers(client: Client, date: string, count = 3) {
  const catalog = await getCpdvCatalogStatus(client);
  if (!catalog.seeded) {
    return { catalog, weekly: null, prayers: [] as BiblePassage[] };
  }
  const weekly = await getPassage(client, WEEKLY_SCRIPTURE_REF);
  const start = dateSeed(date, 17) % MORNING_PRAYER_REFS.length;
  const prayers: BiblePassage[] = [];
  for (let i = 0; i < MORNING_PRAYER_REFS.length && prayers.length < count; i += 1) {
    const ref = MORNING_PRAYER_REFS[(start + i) % MORNING_PRAYER_REFS.length];
    const passage = await getPassage(client, ref);
    if (passage) prayers.push(passage);
  }
  return { catalog, weekly, prayers };
}

async function testamentBookIds(client: Client, testament: "old" | "new") {
  const books = await loadBooks(client);
  return books
    .filter((row) => {
      const nt = isNewTestamentName(row.name);
      if (isExtraBookName(row.name)) return false;
      return testament === "new" ? nt : !nt;
    })
    .map((row) => row.book_id);
}

export async function getRandomPassage(
  client: Client,
  testament: "old" | "new",
  seed: string,
): Promise<BiblePassage | null> {
  const bookIds = await testamentBookIds(client, testament);
  if (!bookIds.length) return null;
  const result = await client.query(
    `SELECT b.name AS book, v.chapter, v.verse, v.text
     FROM bible_cpdv_verses v
     JOIN bible_cpdv_books b ON b.book_id = v.book_id
     WHERE v.book_id = ANY($1::int[])
       AND length(trim(v.text)) BETWEEN 50 AND 420
       AND v.text NOT ILIKE 'Unto the end%'
       AND v.text NOT ILIKE 'A Psalm of%'
       AND v.text NOT ILIKE 'In parts according%'
     ORDER BY md5($2 || '-' || v.verse_id::text)
     LIMIT 12`,
    [bookIds, seed],
  );
  const row = result.rows.find((item) => isReadableVerse(String(item.text || ""))) || result.rows[0];
  if (!row) return null;
  const book = String(row.book);
  const chapter = Number(row.chapter);
  const verse = Number(row.verse);
  const displayBook = book === "Psalms" ? "Psalm" : book.replace(/^III /, "3 ").replace(/^II /, "2 ").replace(/^I /, "1 ");
  return {
    citation: `${displayBook} ${chapter}:${verse}`,
    testament,
    verses: [{ book, chapter, verse, text: String(row.text || "").trim() }],
    text: String(row.text || "").trim(),
  };
}

export async function listDailyScripture(client: Client, date: string, refresh = 0) {
  const catalog = await getCpdvCatalogStatus(client);
  if (!catalog.seeded) {
    return { catalog, weekly: null, old_testament: null, new_testament: null };
  }
  const weekly = await getPassage(client, WEEKLY_SCRIPTURE_REF);
  const salt = refresh > 0 ? `refresh-${refresh}` : "daily";
  const [oldTestament, newTestament] = await Promise.all([
    getRandomPassage(client, "old", `${date}-ot-${salt}`),
    getRandomPassage(client, "new", `${date}-nt-${salt}`),
  ]);
  return {
    catalog,
    weekly,
    old_testament: oldTestament,
    new_testament: newTestament,
  };
}
