/** Daily close parsing for Alpha Vantage. Rounding of position value happens at the database. */

const CASH_SYMBOLS = new Set(["FCASH", "CORE", "FDRXX", "FLGXX"]);

export function isQuotedSymbol(symbol) {
  const text = String(symbol || "").trim().toUpperCase();
  if (!/^[A-Z]{1,5}$/.test(text)) return false;
  return !CASH_SYMBOLS.has(text);
}

/**
 * Latest daily close from an Alpha Vantage TIME_SERIES_DAILY payload.
 * A rate-limit or error note is a failure. A missing close is not treated as zero.
 */
export function latestDailyClose(payload) {
  const series = payload?.["Time Series (Daily)"];
  if (!series || typeof series !== "object") {
    const message = payload?.Note || payload?.Information || payload?.["Error Message"];
    return { ok: false, message: String(message || "No daily prices returned.") };
  }
  const date = Object.keys(series).sort().at(-1);
  const close = decimalClose(series[date]?.["4. close"]);
  if (!date || !close) {
    return { ok: false, message: "Close price was missing." };
  }
  return { ok: true, date, close };
}

/** Keep the vendor's decimal text so a price is not rounded by a JavaScript number. */
function decimalClose(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const normalized = text.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  if (!normalized || Number(normalized) < 0 || !Number.isFinite(Number(normalized))) return null;
  return normalized;
}
