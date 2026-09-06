#!/usr/bin/env node
/**
 * Load the local CPDV (Catholic Public Domain Version) JSON into Postgres.
 * Source: https://github.com/scrollmapper/bible_databases
 * Translation: Catholic Public Domain Version (CPDV). Public domain.
 *
 * Usage:
 *   node scripts/seed-cpdv.mjs
 *   node scripts/seed-cpdv.mjs "C:\\path\\to\\CPDV.json"
 *
 * Override path with CPDV_JSON in .env.
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_JSON = join(__dirname, "..", "data", "bible", "cpdv", "CPDV.json");

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

loadEnv();

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
    await client.query(
      `INSERT INTO ${table} (${colSql}) VALUES ${values.join(", ")}`,
      params,
    );
  }
}

async function run() {
  const jsonPath = process.argv[2] || process.env.CPDV_JSON || DEFAULT_JSON;
  if (!existsSync(jsonPath)) {
    console.error(`CPDV JSON not found: ${jsonPath}`);
    process.exit(1);
  }

  console.log(`Reading ${jsonPath}`);
  const payload = JSON.parse(readFileSync(jsonPath, "utf8"));
  const books = Array.isArray(payload.books) ? payload.books : [];
  if (!books.length) {
    console.error("No books found in CPDV JSON.");
    process.exit(1);
  }

  const bookRows = [];
  const verseRows = [];
  books.forEach((book, index) => {
    const bookId = index + 1;
    const name = String(book?.name || "").trim();
    if (!name) {
      throw new Error(`Book at index ${index} is missing a name.`);
    }
    bookRows.push([bookId, name]);
    for (const chapter of book.chapters || []) {
      const chapterNum = Number(chapter?.chapter);
      for (const verse of chapter?.verses || []) {
        const verseNum = Number(verse?.verse);
        const text = String(verse?.text ?? "");
        if (!Number.isFinite(chapterNum) || !Number.isFinite(verseNum)) {
          throw new Error(`Invalid chapter/verse in ${name}`);
        }
        verseRows.push([bookId, chapterNum, verseNum, text]);
      }
    }
  });

  const client = new Client(dbConfig());
  await client.connect();
  console.log("Connected to database.\n");

  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE bible_cpdv_verses, bible_cpdv_books RESTART IDENTITY CASCADE");
    await client.query(
      `INSERT INTO bible_translations (translation, title, license)
       VALUES ($1, $2, $3)
       ON CONFLICT (translation) DO UPDATE SET
         title = EXCLUDED.title,
         license = EXCLUDED.license`,
      [
        "CPDV",
        String(payload.translation || "CPDV: Catholic Public Domain Version"),
        "Public Domain",
      ],
    );
    await insertChunks(client, "bible_cpdv_books", ["book_id", "name"], bookRows);
    await insertChunks(
      client,
      "bible_cpdv_verses",
      ["book_id", "chapter", "verse", "text"],
      verseRows,
    );
    await client.query("COMMIT");

    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM bible_cpdv_books) AS books,
        (SELECT COUNT(*)::int FROM bible_cpdv_verses) AS verses
    `);
    const { books: bookCount, verses: verseCount } = counts.rows[0];
    console.log(`Seeded CPDV: ${bookCount} books, ${verseCount} verses.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
