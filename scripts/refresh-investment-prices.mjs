#!/usr/bin/env node
/**
 * Refresh quoted investment prices from Alpha Vantage and rewrite Estate account values.
 * Usage: node scripts/refresh-investment-prices.mjs
 * Production runs this from the Vercel cron at /api/cron/investment-prices.
 * Requires ALPHA_VANTAGE_API_KEY in .env. A second run within 18 hours does not call Alpha Vantage.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { refreshInvestmentPrices } from "../utils/refreshInvestmentPrices.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const content = readFileSync(join(root, ".env"), "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function dbClient() {
  const url = process.env.DATABASE_URL;
  if (url) {
    return new Client({
      connectionString: url,
      ssl: url.includes("supabase") ? { rejectUnauthorized: false } : false,
    });
  }
  return new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  });
}

async function main() {
  loadEnv();
  const apiKey = String(process.env.ALPHA_VANTAGE_API_KEY || "").trim();
  if (!apiKey) {
    console.error("Set ALPHA_VANTAGE_API_KEY in .env");
    process.exit(1);
  }

  const client = dbClient();
  await client.connect();
  try {
    const result = await refreshInvestmentPrices(client, apiKey, (line) => console.log(line));
    if (result.ran && result.symbols > 0 && result.skipped.length === result.symbols) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
