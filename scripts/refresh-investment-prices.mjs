#!/usr/bin/env node
/**
 * Refresh quoted investment prices from Alpha Vantage and rewrite Estate account values.
 * Usage: node scripts/refresh-investment-prices.mjs
 * Requires ALPHA_VANTAGE_API_KEY in .env. Pauses between symbols to stay within the free rate limit.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { isQuotedSymbol, latestDailyClose } from "../utils/investmentQuotes.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pauseMs = 13_000;

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

async function fetchClose(symbol, apiKey) {
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "TIME_SERIES_DAILY");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("outputsize", "compact");
  url.searchParams.set("apikey", apiKey);
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) return { ok: false, message: `Alpha Vantage returned ${response.status}.` };
  return latestDailyClose(await response.json());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    const symbols = await client.query(
      `SELECT DISTINCT symbol
       FROM investment_positions
       WHERE shares IS NOT NULL
       ORDER BY symbol`,
    );
    const quoted = symbols.rows.map((row) => String(row.symbol || "").toUpperCase()).filter(isQuotedSymbol);
    const touched = new Set();
    let updated = 0;
    for (let index = 0; index < quoted.length; index += 1) {
      const symbol = quoted[index];
      if (index > 0) await sleep(pauseMs);
      const close = await fetchClose(symbol, apiKey);
      if (!close.ok) {
        console.log(`${symbol}: skipped (${close.message})`);
        continue;
      }
      // A statement can be dated after the last session. Keep the statement balance when the
      // close matches, and reprice only when the official close itself changes.
      const result = await client.query(
        `UPDATE investment_positions
         SET price = $1::numeric,
             price_as_of = $2::date,
             market_value = CASE
               WHEN price IS DISTINCT FROM $1::numeric THEN ROUND(shares * $1::numeric, 2)
               ELSE market_value
             END,
             updated_at = NOW()
         WHERE symbol = $3
           AND shares IS NOT NULL
           AND (price_as_of IS DISTINCT FROM $2::date OR price IS DISTINCT FROM $1::numeric)
         RETURNING ci_id`,
        [close.close, close.date, symbol],
      );
      for (const row of result.rows) touched.add(Number(row.ci_id));
      updated += result.rowCount || 0;
      console.log(`${symbol}: ${close.date} close ${close.close} (${result.rowCount || 0} positions)`);
    }

    for (const accountId of touched) {
      await client.query(
        `UPDATE cash_and_investments ci
         SET value = s.total::numeric::money
         FROM (
           SELECT ci_id, ROUND(SUM(market_value), 2) AS total
           FROM investment_positions
           WHERE ci_id = $1
           GROUP BY ci_id
         ) s
         WHERE ci.ci_id = s.ci_id AND s.total IS NOT NULL`,
        [accountId],
      );
    }
    console.log(`Updated ${updated} positions across ${touched.size} accounts.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
