#!/usr/bin/env node
/**
 * Run SQL migration scripts using the project's pg client and .env.
 * Usage: node scripts/run-migrations.mjs
 * Or with env file: node --env-file=.env scripts/run-migrations.mjs
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptsDir = join(__dirname);

// Load .env manually (no dotenv dependency)
function loadEnv() {
  try {
    const envPath = join(process.cwd(), ".env");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        let val = m[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch {
    // .env not found or unreadable
  }
}

loadEnv();

const migrations = [
  "create_expenses.sql",
  "create_income.sql",
  "alter_income_add_sub_category.sql",
  "alter_expenses_add_sub_category.sql",
  "alter_income_add_income_type.sql",
  "alter_expenses_add_expense_type.sql",
  "create_budget_transactions.sql",
];

async function run() {
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSL } = process.env;
  if (!DB_HOST || !DB_PORT || !DB_NAME || !DB_USER) {
    console.error("Missing DB env vars. Set DB_HOST, DB_PORT, DB_NAME, DB_USER (and DB_PASSWORD if needed).");
    process.exit(1);
  }

  const client = new Client({
    host: DB_HOST,
    port: Number(DB_PORT),
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log("Connected to database.\n");

    for (const file of migrations) {
      const path = join(scriptsDir, file);
      const sql = readFileSync(path, "utf8");
      const cleanSql = sql
        .split("\n")
        .filter((l) => !l.trim().startsWith("--"))
        .join("\n")
        .trim();
      if (!cleanSql) continue;

      try {
        await client.query(cleanSql);
        console.log(`✓ ${file}`);
      } catch (err) {
        console.error(`✗ ${file}:`, err.message);
        throw err;
      }
    }

    console.log("\nMigrations completed.");
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
