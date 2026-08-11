#!/usr/bin/env node
/**
 * Migrate public schema + data from local (DB_*) → new Supabase (SUPABASE_DIRECT_URL).
 *
 * Usage: node scripts/migrate-local-to-supabase.mjs
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  const content = readFileSync(join(root, ".env"), "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) {
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
  }
}

function findPgBin() {
  if (process.platform !== "win32") return "";
  try {
    const pgDir = "C:\\Program Files\\PostgreSQL";
    const dirs = readdirSync(pgDir)
      .filter((d) => /^\d+$/.test(d))
      .map((d) => parseInt(d, 10))
      .sort((a, b) => b - a);
    for (const v of dirs) {
      const bin = join(pgDir, String(v), "bin");
      if (existsSync(join(bin, "pg_dump.exe"))) return bin;
    }
  } catch {
    // ignore
  }
  return "";
}

loadEnv();

const local = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "futureStar",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false,
};

let targetUrl = (
  process.env.SUPABASE_POOLER_URL ||
  process.env.SUPERBASE_POOLER_URL ||
  process.env.SUPABASE_DIRECT_URL ||
  ""
).trim();
if (!targetUrl && process.env.SUPABASE_URL && process.env.SUPABASE_DB_PASSWORD) {
  const m = String(process.env.SUPABASE_URL).match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (m) {
    targetUrl = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${m[1]}.supabase.co:5432/postgres`;
  }
}

if (!local.user || !local.password || !targetUrl) {
  console.error(
    "Need DB_* (local source) and SUPABASE_POOLER_URL (preferred) or SUPABASE_DIRECT_URL.",
  );
  process.exit(1);
}

const pgBin = findPgBin();
if (!pgBin) {
  console.error("PostgreSQL client tools not found under C:\\Program Files\\PostgreSQL");
  process.exit(1);
}

const dumpFile = join(__dirname, `_tmp_local_public_${Date.now()}.sql`);

function run(cmd, args, env = {}) {
  const exe = join(pgBin, `${cmd}.exe`);
  console.log(
    ">",
    cmd,
    args.filter((a) => !String(a).includes("postgresql://") && !String(a).includes("postgres:")).join(" "),
  );
  const r = spawnSync(exe, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...env,
      PATH: `${pgBin};${process.env.PATH || ""}`,
    },
  });
  if (r.status !== 0) throw new Error(`${cmd} failed with status ${r.status}`);
}

const optimizeSql = `
DROP INDEX IF EXISTS idx_account_map_layouts_owner;
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_map_layouts_budget
  ON account_map_layouts (budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_date
  ON budget_transactions (transaction_date);
CREATE INDEX IF NOT EXISTS idx_income_budget ON income (budget_id);
CREATE INDEX IF NOT EXISTS idx_expenses_budget ON expenses (budget_id);
`;

async function verifyCounts(source, target) {
  const srcTables = await source.query(`
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY 1`);
  const mismatches = [];
  for (const { table_name } of srcTables.rows) {
    const s = await source.query(`SELECT COUNT(*)::int AS n FROM public."${table_name}"`);
    let t;
    try {
      t = await target.query(`SELECT COUNT(*)::int AS n FROM public."${table_name}"`);
    } catch {
      mismatches.push({ table: table_name, source: s.rows[0].n, target: "MISSING" });
      continue;
    }
    const ok = s.rows[0].n === t.rows[0].n;
    console.log(`${ok ? "✓" : "✗"} ${table_name}: local=${s.rows[0].n} supabase=${t.rows[0].n}`);
    if (!ok) mismatches.push({ table: table_name, source: s.rows[0].n, target: t.rows[0].n });
  }
  return mismatches;
}

async function main() {
  console.log(`Source: ${local.user}@${local.host}:${local.port}/${local.database}`);
  console.log("Target: Supabase pooler/direct\n");

  if (
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY === process.env.SUPABASE_PUBLISHABLE_KEY
  ) {
    console.warn(
      "WARN: SUPABASE_SERVICE_ROLE_KEY matches SUPABASE_PUBLISHABLE_KEY.\n" +
        "Copy the secret service_role key from Supabase → Settings → API (not the publishable key).\n",
    );
  }

  const source = new Client(local);
  await source.connect();
  console.log("Local connected:", (await source.query("SELECT current_database() AS db")).rows[0]);

  const target = new Client({
    connectionString: targetUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });
  await target.connect();
  console.log("Supabase connected:", (await target.query("SELECT current_database() AS db")).rows[0]);

  const existing = await target.query(`
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY 1`);
  const appTables = existing.rows.map((r) => r.table_name);
  if (appTables.length) {
    console.log(`\nDropping ${appTables.length} existing public tables on Supabase before restore...`);
    await target.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN
          SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        LOOP
          EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
        END LOOP;
      END $$;
    `);
  }
  await target.end();

  console.log("\n1) Dumping local public schema+data...");
  run(
    "pg_dump",
    [
      "--format=plain",
      "--no-owner",
      "--no-acl",
      "--schema=public",
      "--encoding=UTF8",
      "-h",
      local.host,
      "-p",
      String(local.port),
      "-U",
      local.user,
      "-d",
      local.database,
      "-f",
      dumpFile,
    ],
    { PGPASSWORD: local.password },
  );

  let sql = readFileSync(dumpFile, "utf8");
  sql = sql
    .replace(/^CREATE SCHEMA public;\s*$/gm, "-- CREATE SCHEMA public;")
    .replace(/^CREATE SCHEMA IF NOT EXISTS public;\s*$/gm, "-- CREATE SCHEMA IF NOT EXISTS public;")
    .replace(/^ALTER SCHEMA public OWNER TO .*;\s*$/gm, "-- ALTER SCHEMA public OWNER ...");
  writeFileSync(dumpFile, sql);

  console.log("\n2) Restoring into Supabase...");
  run(
    "psql",
    [targetUrl, "-v", "ON_ERROR_STOP=1", "-f", dumpFile],
    { PGSSLMODE: "require", NODE_TLS_REJECT_UNAUTHORIZED: "0" },
  );

  const target2 = new Client({
    connectionString: targetUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });
  await target2.connect();
  console.log("\n3) Applying optimize indexes...");
  await target2.query(optimizeSql);

  console.log("\n4) Verifying row counts...");
  const mismatches = await verifyCounts(source, target2);
  const fkCount = (
    await target2.query(`
    SELECT COUNT(*)::int AS n
    FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY'`)
  ).rows[0].n;
  console.log(`Foreign keys on Supabase: ${fkCount}`);

  await source.end();
  await target2.end();
  if (existsSync(dumpFile)) unlinkSync(dumpFile);

  if (mismatches.length) {
    console.error("\nCount mismatches:", mismatches);
    process.exit(1);
  }
  console.log("\nMigration complete: local → new Supabase.");
  console.log("Next: set DATABASE_URL to the new Supabase pooler/direct URI and restart the app.");
}

main().catch((err) => {
  console.error(err);
  if (existsSync(dumpFile)) {
    try {
      unlinkSync(dumpFile);
    } catch {
      // ignore
    }
  }
  process.exit(1);
});
