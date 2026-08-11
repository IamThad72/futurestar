#!/usr/bin/env node
/**
 * Migrate public schema + data from Supabase (DATABASE_URL) → local futureStar (DB_*).
 *
 * Usage: node scripts/migrate-supabase-to-local.mjs
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  const envPath = join(root, ".env");
  const content = readFileSync(envPath, "utf8");
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

const sourceUrl = process.env.DATABASE_URL;
const local = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "futureStar",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false,
};

if (!sourceUrl || !local.user || !local.password) {
  console.error("Need DATABASE_URL (Supabase source) and DB_* (local target) in .env");
  process.exit(1);
}

const pgBin = findPgBin();
if (!pgBin) {
  console.error("PostgreSQL client tools not found under C:\\Program Files\\PostgreSQL");
  process.exit(1);
}

const dumpFile = join(__dirname, `_tmp_supabase_public_${Date.now()}.sql`);

function run(cmd, args, env = {}) {
  const exe = join(pgBin, `${cmd}.exe`);
  console.log(">", cmd, args.filter((a) => !String(a).includes("postgresql://")).join(" "));
  const r = spawnSync(exe, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...env,
      PATH: `${pgBin};${process.env.PATH || ""}`,
    },
  });
  if (r.status !== 0) {
    throw new Error(`${cmd} failed with status ${r.status}`);
  }
}

const optimizeSql = `
-- Optimal local tweaks (app-compatible)
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
  let fkCount = 0;
  for (const { table_name } of srcTables.rows) {
    const s = await source.query(`SELECT COUNT(*)::int AS n FROM public."${table_name}"`);
    const t = await target.query(`SELECT COUNT(*)::int AS n FROM public."${table_name}"`);
    const ok = s.rows[0].n === t.rows[0].n;
    console.log(`${ok ? "✓" : "✗"} ${table_name}: source=${s.rows[0].n} local=${t.rows[0].n}`);
    if (!ok) mismatches.push({ table: table_name, source: s.rows[0].n, target: t.rows[0].n });
  }
  const fks = await target.query(`
    SELECT COUNT(*)::int AS n
    FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY'`);
  fkCount = fks.rows[0].n;
  console.log(`Foreign keys on local: ${fkCount}`);
  return { mismatches, fkCount };
}

async function main() {
  console.log("Source: Supabase DATABASE_URL");
  console.log(`Target: ${local.user}@${local.host}:${local.port}/${local.database}\n`);

  const target = new Client(local);
  await target.connect();
  console.log("Local connected:", (await target.query("SELECT current_user, current_database()")).rows[0]);

  console.log("\n0) Resetting public schema on local...");
  await target.query(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO CURRENT_USER;
    GRANT ALL ON SCHEMA public TO public;
    GRANT USAGE ON SCHEMA public TO public;
  `);
  await target.end();

  console.log("\n1) Dumping Supabase public schema+data...");
  run(
    "pg_dump",
    [
      "--format=plain",
      "--no-owner",
      "--no-acl",
      "--schema=public",
      "--encoding=UTF8",
      "-f",
      dumpFile,
      sourceUrl,
    ],
    { PGSSLMODE: "require" },
  );

  // Avoid "schema public already exists" on restore
  let sql = readFileSync(dumpFile, "utf8");
  sql = sql
    .replace(/^CREATE SCHEMA public;\s*$/gm, "-- CREATE SCHEMA public; (kept existing)")
    .replace(/^CREATE SCHEMA IF NOT EXISTS public;\s*$/gm, "-- CREATE SCHEMA IF NOT EXISTS public;");
  writeFileSync(dumpFile, sql);

  console.log("\n2) Restoring into local futureStar...");
  run(
    "psql",
    [
      "-h",
      local.host,
      "-p",
      String(local.port),
      "-U",
      local.user,
      "-d",
      local.database,
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      dumpFile,
    ],
    { PGPASSWORD: local.password },
  );

  const target2 = new Client(local);
  await target2.connect();
  console.log("\n3) Applying optimal local indexes...");
  await target2.query(optimizeSql);

  console.log("\n4) Resetting identity/serial sequences...");
  await target2.query(`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN
        SELECT
          n.nspname || '.' || c.relname AS seq,
          tn.nspname || '.' || tc.relname AS tbl,
          a.attname AS col
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_depend d ON d.objid = c.oid AND d.deptype IN ('a', 'i')
        JOIN pg_class tc ON tc.oid = d.refobjid
        JOIN pg_namespace tn ON tn.oid = tc.relnamespace
        JOIN pg_attribute a ON a.attrelid = tc.oid AND a.attnum = d.refobjsubid
        WHERE c.relkind = 'S' AND n.nspname = 'public'
      LOOP
        EXECUTE format(
          'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %s), 1), true)',
          r.seq, r.col, r.tbl
        );
      END LOOP;
    END $$;
  `);
  console.log("✓ sequences reset");

  const source = new Client({
    connectionString: sourceUrl,
    ssl: { rejectUnauthorized: false },
  });
  await source.connect();
  console.log("\n5) Verifying...");
  const { mismatches, fkCount } = await verifyCounts(source, target2);
  await source.end();
  await target2.end();

  if (existsSync(dumpFile)) unlinkSync(dumpFile);

  if (mismatches.length) {
    console.error("\nCount mismatches:", mismatches);
    process.exit(1);
  }
  if (fkCount < 10) {
    console.error("\nExpected foreign keys on local schema; got", fkCount);
    process.exit(1);
  }
  console.log("\nMigration complete with full schema + data.");
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
