#!/usr/bin/env node
/**
 * Migrate estate_mgmt_db to Supabase using pg_dump + psql.
 * Per Supabase docs: https://supabase.com/docs/guides/platform/migrating-to-supabase/postgres
 *
 * Usage: node --env-file=.env scripts/migrate-to-supabase.mjs
 * Or:    node scripts/migrate-to-supabase.mjs  (loads .env from cwd)
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) {
    console.error(".env not found. Set DB_* (source) and SUPABASE_URL + SUPABASE_DB_PASSWORD.");
    process.exit(1);
  }
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) {
      const k = m[1].trim();
      let v = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

loadEnv();

const DB_HOST = process.env.DB_HOST;
const DB_PORT = process.env.DB_PORT;
const DB_NAME = process.env.DB_NAME || "estate_mgmt_db";
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DB_HOST || !DB_PORT || !DB_USER) {
  console.error("Missing DB_HOST, DB_PORT, DB_USER in .env");
  process.exit(1);
}

let targetUrl = DATABASE_URL;
if (!targetUrl && SUPABASE_URL && SUPABASE_DB_PASSWORD) {
  const m = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (m) {
    targetUrl = `postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${m[1]}.supabase.co:5432/postgres`;
  }
}
if (!targetUrl) {
  console.error("Set DATABASE_URL or SUPABASE_URL + SUPABASE_DB_PASSWORD in .env");
  process.exit(1);
}
if (!targetUrl.includes("sslmode=")) {
  targetUrl += (targetUrl.includes("?") ? "&" : "?") + "sslmode=require";
}

const dumpFile = join(root, `db-dump-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}.sql`);

// Find pg_dump/psql on Windows (often not in PATH)
let pgBin = "";
if (process.platform === "win32") {
  try {
    const pgDir = "C:\\Program Files\\PostgreSQL";
    const dirs = readdirSync(pgDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d+$/.test(d.name))
      .map((d) => parseInt(d.name, 10))
      .sort((a, b) => b - a);
    for (const v of dirs) {
      const bin = join(pgDir, String(v), "bin");
      if (existsSync(join(bin, "pg_dump.exe"))) {
        pgBin = bin;
        break;
      }
    }
  } catch {}
}

const run = (cmd, args, env = {}) => {
  const exe = process.platform === "win32" && pgBin ? join(pgBin, cmd + ".exe") : cmd;
  const opts = { stdio: "inherit", env: { ...process.env, ...env } };
  if (pgBin) opts.env.PATH = pgBin + (process.env.PATH ? ";" + process.env.PATH : "");
  const r = spawnSync(exe, args, opts);
  if (r.status !== 0) process.exit(r.status ?? 1);
};

console.log("Source:", `${DB_HOST}:${DB_PORT}/${DB_NAME}`);
console.log("Target: Supabase");
console.log("Dump file:", dumpFile);
console.log("");

console.log("1. Dumping source database...");
run("pg_dump", [
  "-h", DB_HOST,
  "-p", DB_PORT,
  "-U", DB_USER,
  "-d", DB_NAME,
  "-F", "p",
  "-f", dumpFile,
  "--no-owner", "--no-privileges", "--no-subscriptions", "--clean",
], { PGPASSWORD: DB_PASSWORD });
console.log("   Dump saved.\n");

console.log("2. Restoring to Supabase...");
run("psql", [targetUrl, "-f", dumpFile]);
console.log("   Restore done.\n");

console.log("3. Running VACUUM ANALYZE...");
run("psql", [targetUrl, "-c", "VACUUM VERBOSE ANALYZE;"]);
console.log("   Done.\n");

console.log("Migration complete. Database is now on Supabase.");
