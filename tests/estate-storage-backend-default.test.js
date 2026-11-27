import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const ALTER = "ALTER TABLE public.estate_documents ALTER COLUMN storage_backend SET DEFAULT 'supabase';";
const MIGRATION = "alter_estate_documents_storage_backend_default.sql";

function listedMigrations(source) {
  const start = source.indexOf("const migrations = [");
  const end = source.indexOf("];", start);
  assert.ok(start >= 0 && end > start, "migrations array is present");
  return [...source.slice(start, end).matchAll(/"([^"]+\.sql)"/g)].map((match) => match[1]);
}

test("estate storage_backend defaults to supabase for new tables and existing databases", () => {
  const create = read("scripts/create_estate_documents.sql");
  const alter = read(`scripts/${MIGRATION}`);
  const runner = read("scripts/run-migrations.mjs");
  const listed = listedMigrations(runner);

  assert.match(create, /storage_backend TEXT NOT NULL DEFAULT 'supabase'/);
  assert.doesNotMatch(create, /DEFAULT 'disk'/);

  const createAt = listed.indexOf("create_estate_documents.sql");
  const alterAt = listed.indexOf(MIGRATION);
  assert.ok(createAt >= 0, "create_estate_documents.sql is registered");
  assert.equal(alterAt, createAt + 1, `${MIGRATION} runs immediately after the create script`);
  assert.equal(listed.filter((name) => name === MIGRATION).length, 1);

  assert.match(alter, /DO \$\$/);
  assert.match(alter, /to_regclass\('public\.estate_documents'\) IS NULL/);
  assert.match(alter, /RAISE NOTICE 'estate_documents is missing/);
  assert.match(alter, /column_name = 'storage_backend'/);
  assert.match(alter, /column_default IN \('''supabase''::text', '''supabase'''\)/);
  assert.match(alter, /RETURN;/);
  assert.equal(alter.includes(ALTER), true);
  assert.equal(alter.split(ALTER).length - 1, 1);

  const missingGuard = alter.indexOf("to_regclass('public.estate_documents') IS NULL");
  const alreadySetGuard = alter.indexOf("column_default IN ('''supabase''::text', '''supabase''')");
  const alterStatement = alter.indexOf(ALTER);
  assert.ok(missingGuard >= 0 && missingGuard < alterStatement);
  assert.ok(alreadySetGuard >= 0 && alreadySetGuard < alterStatement);
  assert.ok(alter.lastIndexOf("RETURN;") < alterStatement);

  assert.doesNotMatch(alter, /^\s*(UPDATE|DELETE)\b/im);
  assert.match(alter, /Does not update or delete rows/);
  assert.match(alter, /Existing rows keep the storage_backend they already have/);
});
