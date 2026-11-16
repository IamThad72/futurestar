/** Repeated merchants that are not already a budget line. */

const SKIP = /\b(transfer|paycheck|payroll|payment|deposit|atm|venmo|zelle|interest|dividend)\b/i;

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleCaseMerchant(value) {
  return normalize(value)
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .slice(0, 80);
}

export function candidateMerchants(rows, existingLabels) {
  const existing = (existingLabels || []).map(normalize).filter((label) => label.length >= 3);
  const existingSet = new Set(existing);
  const out = [];
  for (const row of rows || []) {
    const name = normalize(row.description);
    const count = Number(row.count) || 0;
    if (name.length < 3 || count < 3 || SKIP.test(name)) continue;
    if (existingSet.has(name)) continue;
    if (existing.some((label) => name.includes(label) || label.includes(name))) continue;
    out.push({
      description: name,
      count,
      monthly_amount: Math.round((Number(row.average) || 0) * 100) / 100,
    });
    if (out.length >= 8) break;
  }
  return out;
}
