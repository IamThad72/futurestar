/** Shared Alpha Vantage refresh used by the local script and the Vercel cron route. */
import { isQuotedSymbol, latestDailyClose } from "./investmentQuotes.js";

const pauseMs = 13_000;

export function cronAuthorized(authorization, secret) {
  const expected = String(secret || "").trim();
  if (expected.length < 16) return false;
  return String(authorization || "") === `Bearer ${expected}`;
}

async function claimPriceRun(client) {
  await client.query(
    `CREATE TABLE IF NOT EXISTS investment_price_runs (
       id integer PRIMARY KEY,
       started_at timestamptz NOT NULL,
       finished_at timestamptz
     )`,
  );
  const claimed = await client.query(
    `INSERT INTO investment_price_runs (id, started_at, finished_at)
     VALUES (1, NOW(), NULL)
     ON CONFLICT (id) DO UPDATE
     SET started_at = NOW(),
         finished_at = NULL
     WHERE (
       investment_price_runs.finished_at IS NULL
       AND investment_price_runs.started_at < NOW() - INTERVAL '20 minutes'
     )
     OR investment_price_runs.finished_at < NOW() - INTERVAL '18 hours'
     RETURNING id`,
  );
  return (claimed.rowCount || 0) > 0;
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

/**
 * Fetch one daily close per quoted symbol and reprice positions whose close changed.
 * A second run within 18 hours does not call Alpha Vantage.
 */
export async function refreshInvestmentPrices(client, apiKey, log = () => {}) {
  const key = String(apiKey || "").trim();
  if (!key) throw new Error("Set ALPHA_VANTAGE_API_KEY.");

  const claimed = await claimPriceRun(client);
  if (!claimed) {
    log("Price refresh already ran or is in progress.");
    return { ran: false, updated: 0, accounts: 0, symbols: 0, skipped: [] };
  }

  const symbols = await client.query(
    `SELECT DISTINCT symbol
     FROM investment_positions
     WHERE shares IS NOT NULL
     ORDER BY symbol`,
  );
  const quoted = symbols.rows.map((row) => String(row.symbol || "").toUpperCase()).filter(isQuotedSymbol);
  const touched = new Set();
  const skipped = [];
  let updated = 0;

  for (let index = 0; index < quoted.length; index += 1) {
    const symbol = quoted[index];
    if (index > 0) await sleep(pauseMs);
    const close = await fetchClose(symbol, key);
    if (!close.ok) {
      skipped.push({ symbol, message: close.message });
      log(`${symbol}: skipped (${close.message})`);
      continue;
    }
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
    log(`${symbol}: ${close.date} close ${close.close} (${result.rowCount || 0} positions)`);
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

  await client.query(`UPDATE investment_price_runs SET finished_at = NOW() WHERE id = 1`);
  log(`Updated ${updated} positions across ${touched.size} accounts.`);
  return { ran: true, updated, accounts: touched.size, symbols: quoted.length, skipped };
}
