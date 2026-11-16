/** Pull amount, date, and a description out of one spoken transaction. */

function pad(n) {
  return String(n).padStart(2, "0");
}

export function addIsoDays(iso, days) {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + Number(days || 0));
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseTransactionSentence(text, todayIso) {
  const raw = String(text || "").trim();
  if (raw.length < 2 || raw.length > 240) return null;
  const amountMatch = raw.match(/\$?\s*(\d{1,7}(?:\.\d{1,2})?)/);
  if (!amountMatch) return null;
  const amount = Math.round(Number(amountMatch[1]) * 100) / 100;
  if (!(amount > 0) || amount > 1000000) return null;

  let date = String(todayIso || "").match(/^\d{4}-\d{2}-\d{2}$/) ? todayIso : "";
  const lower = raw.toLowerCase();
  if (/\byesterday\b/.test(lower) && date) date = addIsoDays(date, -1);
  else if (/\btomorrow\b/.test(lower) && date) date = addIsoDays(date, 1);
  const iso = raw.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) date = iso[1];
  if (!date) return null;

  const description = raw
    .replace(amountMatch[0], " ")
    .replace(/\b(yesterday|today|tomorrow)\b/gi, " ")
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, " ")
    .replace(/[$,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  if (!description) return null;
  return { amount, date, description };
}
