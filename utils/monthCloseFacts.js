/** Compare a month of expense lines with what was recorded. */

function money(amount) {
  return (Math.round(Number(amount) * 100) / 100).toFixed(2);
}

function label(category, subCategory) {
  const cat = String(category || "").trim() || "Uncategorized";
  const sub = String(subCategory || "").trim();
  return sub ? `${cat} / ${sub}` : cat;
}

function round(amount) {
  return Math.round(Number(amount) * 100) / 100;
}

export function buildMonthClose(lines, transactions) {
  const byKey = new Map();
  for (const line of lines || []) {
    const key = label(line.category, line.sub_category);
    const row = byKey.get(key) || { label: key, budget: 0, actual: 0 };
    row.budget = round(row.budget + (Number(line.monthly_amount) || 0));
    byKey.set(key, row);
  }
  const merchants = new Map();
  for (const tx of transactions || []) {
    const key = label(tx.category, tx.sub_category);
    const row = byKey.get(key) || { label: key, budget: 0, actual: 0 };
    const amount = Math.abs(Number(tx.amount) || 0);
    row.actual = round(row.actual + amount);
    byKey.set(key, row);
    const cat = String(tx.category || "").trim().toLowerCase();
    if (!cat || cat === "uncategorized") {
      const name = String(tx.description || "Unknown").trim() || "Unknown";
      merchants.set(name, round((merchants.get(name) || 0) + amount));
    }
  }

  let over = null;
  let under = null;
  for (const row of byKey.values()) {
    if (!row.budget && !row.actual) continue;
    const diff = round(row.actual - row.budget);
    if (diff > 0 && (!over || diff > over.amount)) over = { label: row.label, amount: diff };
    if (diff < 0 && (!under || -diff > under.amount)) under = { label: row.label, amount: round(-diff) };
  }
  const unmatched = [...merchants.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, amount]) => ({ name, amount }));
  return { over, under, unmatched };
}

export function monthCloseSentence(facts, monthLabel) {
  const when = monthLabel ? `${monthLabel}: ` : "";
  const parts = [];
  if (facts?.over) parts.push(`${facts.over.label} is $${money(facts.over.amount)} over budget`);
  else parts.push("no category is over budget");
  if (facts?.under) parts.push(`${facts.under.label} is $${money(facts.under.amount)} under budget`);
  if (facts?.unmatched?.length) {
    parts.push(`uncategorized merchants include ${facts.unmatched.map((row) => row.name).join(", ")}`);
  }
  const sentence = `${when}${parts.join("; ")}.`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
