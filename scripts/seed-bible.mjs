#!/usr/bin/env node
/**
 * Load public-domain Bible translations into bible_translations, bible_books
 * and bible_verses (scripts/create_bible.sql must run first).
 *
 *   BSB  Berean Standard Bible          public domain since Apr 30, 2023 (berean.bible/terms.htm)
 *   WEB  World English Bible            public domain (ebible.org; name is an eBible.org trademark, text unchanged)
 *   KJV  King James Version (1769)      public domain in the US
 *   CPDV Catholic Public Domain Version public domain
 *
 * BSB, KJV and CPDV come from https://github.com/scrollmapper/bible_databases (JSON).
 * WEB comes from https://ebible.org/Scriptures/eng-web_vpl.zip (verse-per-line text).
 * Files are downloaded once into data/bible/<code>/ (git-ignored, about 5–10 MB each).
 *
 * Usage:
 *   node scripts/seed-bible.mjs BSB
 *   node scripts/seed-bible.mjs WEB KJV
 *   node scripts/seed-bible.mjs all
 *   node scripts/seed-bible.mjs CPDV --file "C:\\path\\to\\CPDV.json"
 *   node scripts/seed-bible.mjs BSB --dry-run     (download and parse only; no database)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { inflateRawSync } from "zlib";
import { Client } from "pg";
import { BIBLE_TRANSLATIONS, bibleTranslation } from "../utils/bibleTranslations.js";
import { bookNameForCode, classifyBook } from "../utils/bibleBooks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data", "bible");

function loadEnv() {
  try {
    const content = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // no .env
  }
}

function dbConfig() {
  const { DATABASE_URL, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSL } =
    process.env;
  if (DATABASE_URL) {
    return {
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes("supabase") ? { rejectUnauthorized: false } : false,
    };
  }
  if (!DB_HOST || !DB_PORT || !DB_NAME || !DB_USER) {
    console.error("Set DATABASE_URL or DB_HOST, DB_PORT, DB_NAME, DB_USER in .env");
    process.exit(1);
  }
  return {
    host: DB_HOST,
    port: Number(DB_PORT),
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  };
}

function parseArgs(argv) {
  const codes = [];
  let file = "";
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") {
      file = argv[i + 1] || "";
      i += 1;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.toLowerCase() === "all") {
      codes.push(...BIBLE_TRANSLATIONS.map((item) => item.code));
    } else {
      codes.push(arg.toUpperCase());
    }
  }
  return { codes: [...new Set(codes)], file, dryRun };
}

async function download(url, target) {
  console.log(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, buffer);
  console.log(`Saved ${target} (${(buffer.length / 1_048_576).toFixed(1)} MB)`);
  return buffer;
}

async function sourceBuffer(translation, overrideFile) {
  if (overrideFile) {
    if (!existsSync(overrideFile)) throw new Error(`File not found: ${overrideFile}`);
    return readFileSync(overrideFile);
  }
  const envOverride = translation.code === "CPDV" ? process.env.CPDV_JSON : "";
  if (envOverride && existsSync(envOverride)) return readFileSync(envOverride);
  const target = join(DATA_DIR, translation.code.toLowerCase(), translation.source.file);
  if (existsSync(target)) {
    console.log(`Using cached ${target}`);
    return readFileSync(target);
  }
  return download(translation.source.url, target);
}

/** Minimal ZIP reader (stored or deflated entries) so no unzip tool is needed. */
export function readZipEntry(buffer, matches) {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a ZIP file.");
  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let n = 0; n < entries; n += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Bad ZIP directory.");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;
    if (!matches(name)) continue;
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(start, start + compressedSize);
    if (method === 0) return data;
    if (method === 8) return inflateRawSync(data);
    throw new Error(`Unsupported ZIP compression method ${method} for ${name}.`);
  }
  throw new Error("Entry not found in ZIP.");
}

/** scrollmapper JSON: { translation, books: [{ name, chapters: [{ chapter, verses: [{ verse, text }] }] }] } */
function parseScrollmapperJson(buffer) {
  const payload = JSON.parse(buffer.toString("utf8"));
  const books = Array.isArray(payload.books) ? payload.books : [];
  return books.map((book) => ({
    name: String(book?.name || "").trim(),
    verses: (book?.chapters || []).flatMap((chapter) =>
      (chapter?.verses || []).map((verse) => ({
        chapter: Number(chapter?.chapter),
        verse: Number(verse?.verse),
        text: String(verse?.text ?? "").trim(),
      })),
    ),
  }));
}

/** eBible.org VPL: one verse per line, "GEN 1:1 In the beginning…". */
function parseEbibleVplZip(buffer) {
  const text = readZipEntry(buffer, (name) => /_vpl\.txt$/i.test(name)).toString("utf8");
  const books = [];
  const byCode = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = /^([0-9A-Z]{3})\s+(\d+):(\d+)\s+(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, code, chapter, verse, body] = match;
    let book = byCode.get(code);
    if (!book) {
      const name = bookNameForCode(code);
      if (!name) throw new Error(`Unknown book code ${code} in WEB file.`);
      book = { name, verses: [] };
      byCode.set(code, book);
      books.push(book);
    }
    book.verses.push({ chapter: Number(chapter), verse: Number(verse), text: body.trim() });
  }
  return books;
}

function parseSource(translation, buffer, overrideFile) {
  const looksJson = overrideFile ? /\.json$/i.test(overrideFile) : translation.source.format === "scrollmapper-json";
  return looksJson ? parseScrollmapperJson(buffer) : parseEbibleVplZip(buffer);
}

function buildRows(code, books) {
  const bookRows = [];
  const verseRows = [];
  const seen = new Set();
  books.forEach((book, index) => {
    if (!book.name) throw new Error(`Book at index ${index} is missing a name.`);
    const bookId = index + 1;
    const info = classifyBook(book.name);
    bookRows.push([code, bookId, book.name, info.key, info.testament, info.canon]);
    for (const verse of book.verses) {
      if (!Number.isFinite(verse.chapter) || !Number.isFinite(verse.verse)) {
        throw new Error(`Invalid chapter/verse in ${book.name}`);
      }
      if (!verse.text) continue;
      const key = `${bookId}:${verse.chapter}:${verse.verse}`;
      if (seen.has(key)) continue;
      seen.add(key);
      verseRows.push([code, bookId, verse.chapter, verse.verse, verse.text]);
    }
  });
  return { bookRows, verseRows };
}

async function insertChunks(client, table, columns, rows, chunkSize = 400) {
  const colCount = columns.length;
  const colSql = columns.join(", ");
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    if (!slice.length) continue;
    const params = [];
    const values = slice.map((row, r) => {
      const base = r * colCount;
      params.push(...row);
      return `(${Array.from({ length: colCount }, (_, c) => `$${base + c + 1}`).join(", ")})`;
    });
    await client.query(`INSERT INTO ${table} (${colSql}) VALUES ${values.join(", ")}`, params);
  }
}

async function seedTranslation(client, translation, bookRows, verseRows) {
  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO bible_translations (translation, title, license, name, versification, source_url, seeded_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (translation) DO UPDATE SET
         title = EXCLUDED.title,
         license = EXCLUDED.license,
         name = EXCLUDED.name,
         versification = EXCLUDED.versification,
         source_url = EXCLUDED.source_url,
         seeded_at = NOW()`,
      [
        translation.code,
        translation.title,
        translation.license,
        translation.name,
        translation.versification,
        translation.source.url,
      ],
    );
    // Replaces only this translation's rows (verses cascade from books).
    await client.query("DELETE FROM bible_books WHERE translation = $1", [translation.code]);
    await insertChunks(client, "bible_books", ["translation", "book_id", "name", "book_key", "testament", "canon"], bookRows);
    await insertChunks(client, "bible_verses", ["translation", "book_id", "chapter", "verse", "text"], verseRows);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function run() {
  loadEnv();
  const { codes, file, dryRun } = parseArgs(process.argv.slice(2));
  if (!codes.length) {
    console.error(`Name a translation: ${BIBLE_TRANSLATIONS.map((item) => item.code).join(", ")} or all.`);
    process.exit(1);
  }
  if (file && codes.length !== 1) {
    console.error("--file works with one translation at a time.");
    process.exit(1);
  }
  const translations = codes.map((code) => {
    const translation = bibleTranslation(code);
    if (!translation) {
      console.error(`Unknown translation ${code}. Use ${BIBLE_TRANSLATIONS.map((item) => item.code).join(", ")}.`);
      process.exit(1);
    }
    return translation;
  });

  let client = null;
  if (!dryRun) {
    client = new Client(dbConfig());
    await client.connect();
    console.log("Connected to database.\n");
  }

  try {
    for (const translation of translations) {
      const buffer = await sourceBuffer(translation, file);
      const books = parseSource(translation, buffer, file);
      if (!books.length) throw new Error(`No books found for ${translation.code}.`);
      const { bookRows, verseRows } = buildRows(translation.code, books);
      const shared = bookRows.filter((row) => row[5] === "protestant").length;
      console.log(
        `${translation.code}: ${bookRows.length} books (${shared} shared), ${verseRows.length} verses parsed.`,
      );
      if (dryRun) continue;
      await seedTranslation(client, translation, bookRows, verseRows);
      const counts = await client.query(
        `SELECT
           (SELECT COUNT(*)::int FROM bible_books WHERE translation = $1) AS books,
           (SELECT COUNT(*)::int FROM bible_verses WHERE translation = $1) AS verses`,
        [translation.code],
      );
      console.log(`Seeded ${translation.code}: ${counts.rows[0].books} books, ${counts.rows[0].verses} verses.\n`);
    }
  } finally {
    await client?.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
