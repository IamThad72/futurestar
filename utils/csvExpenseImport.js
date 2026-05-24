/** CSV expense import: historical budget-line suggestions and duplicate detection. */

/** Normalize to YYYY-MM-DD so CSV rows match DB transaction dates */
export function normalizeDateForDedupe(dateVal) {
  if (dateVal == null || dateVal === "") return null;
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${dateVal.getFullYear()}-${pad(dateVal.getMonth() + 1)}-${pad(dateVal.getDate())}`;
  }
  const s = String(dateVal).trim();
  const isoPrefix = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoPrefix) return `${isoPrefix[1]}-${isoPrefix[2]}-${isoPrefix[3]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return null;
}

export function normalizeAmountForDedupe(amount) {
  const n = parseFloat(String(amount ?? "").replace(/[$,]/g, ""));
  if (isNaN(n)) return null;
  return Math.round(Math.abs(n) * 100) / 100;
}

export function normalizeExpenseDescription(text) {
  return String(text ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function pickMostCommonBudgetItemKey(countByKey) {
  let best = "";
  let bestCount = 0;
  for (const [key, count] of countByKey.entries()) {
    if (count > bestCount) {
      bestCount = count;
      best = key;
    }
  }
  return best;
}

/** Composite select value: expense lines use e:id, insurance (income deduction) lines use i:id */
export function csvBudgetItemKey(kind, id) {
  const n = parseInt(String(id), 10);
  if (isNaN(n) || n <= 0) return "";
  return kind === "insurance" ? `i:${n}` : `e:${n}`;
}

export function parseCsvBudgetItemKey(key) {
  if (key == null || key === "") return null;
  const m = String(key).match(/^([ei]):(\d+)$/);
  if (m) {
    const id = parseInt(m[2], 10);
    if (isNaN(id) || id <= 0) return null;
    return { kind: m[1] === "i" ? "insurance" : "expense", id };
  }
  const n = parseInt(String(key), 10);
  if (!isNaN(n) && n > 0) return { kind: "expense", id: n };
  return null;
}

function transactionBudgetItemKey(tx) {
  if (tx.type === "expense" || (tx.expense_id != null && tx.income_id == null)) {
    if (tx.expense_id == null) return null;
    return csvBudgetItemKey("expense", tx.expense_id);
  }
  if (tx.income_id != null && (tx.item_type === "deduction" || tx.type === "insurance")) {
    return csvBudgetItemKey("insurance", tx.income_id);
  }
  return null;
}

function rowBudgetItemKey(row) {
  if (row?.budgetItemId != null && row.budgetItemId !== "") {
    const parsed = parseCsvBudgetItemKey(row.budgetItemId);
    if (parsed) return csvBudgetItemKey(parsed.kind, parsed.id);
  }
  if (row?.expense_id != null) return csvBudgetItemKey("expense", row.expense_id);
  if (row?.income_id != null && row?.item_type === "deduction") {
    return csvBudgetItemKey("insurance", row.income_id);
  }
  return null;
}

/** norm description -> Map<budgetItemKey, count> from past expense and insurance transactions */
export function buildExpenseIdSuggestionMap(transactions) {
  const byDesc = new Map();
  for (const tx of transactions ?? []) {
    const itemKey = transactionBudgetItemKey(tx);
    if (!itemKey) continue;
    const norm = normalizeExpenseDescription(tx.description);
    if (!norm) continue;
    if (!byDesc.has(norm)) byDesc.set(norm, new Map());
    const inner = byDesc.get(norm);
    inner.set(itemKey, (inner.get(itemKey) || 0) + 1);
  }
  return byDesc;
}

export function suggestExpenseBudgetItemId(description, suggestionMap, validExpenseIds) {
  const valid = validExpenseIds instanceof Set ? validExpenseIds : new Set(validExpenseIds ?? []);
  const norm = normalizeExpenseDescription(description);
  if (!norm || !suggestionMap?.size) return "";

  const pickValid = (countMap) => {
    const key = pickMostCommonBudgetItemKey(countMap);
    return key && valid.has(key) ? key : "";
  };

  if (suggestionMap.has(norm)) {
    const id = pickValid(suggestionMap.get(norm));
    if (id) return id;
  }

  let bestId = "";
  let bestScore = 0;
  for (const [key, countMap] of suggestionMap) {
    if (key === norm) continue;
    if (!(key.includes(norm) || norm.includes(key))) continue;
    const id = pickValid(countMap);
    if (!id) continue;
    const score = [...countMap.values()].reduce((a, b) => a + b, 0);
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestId;
}

export function expenseCsvDedupeKey(expenseId, dateStr, amount) {
  return budgetCsvDedupeKey(csvBudgetItemKey("expense", expenseId), dateStr, amount);
}

export function budgetCsvDedupeKey(budgetItemKey, dateStr, amount) {
  const parsed = parseCsvBudgetItemKey(budgetItemKey);
  if (!parsed) return null;
  const d = normalizeDateForDedupe(dateStr);
  if (!d) return null;
  const amt = normalizeAmountForDedupe(amount);
  if (amt == null) return null;
  const prefix = parsed.kind === "insurance" ? "i" : "e";
  return `${prefix}:${parsed.id}|${d}|${amt}`;
}

export function expenseCsvDetailDedupeKey(dateStr, amount, description) {
  const d = normalizeDateForDedupe(dateStr);
  if (!d) return null;
  const amt = normalizeAmountForDedupe(amount);
  if (amt == null) return null;
  const desc = normalizeExpenseDescription(description);
  if (!desc) return null;
  return `d:${d}|${amt}|${desc}`;
}

export function buildExistingExpenseDedupeSets(transactions) {
  const keysWithExpense = new Set();
  const keysByDetail = new Set();
  for (const tx of transactions ?? []) {
    const itemKey = transactionBudgetItemKey(tx);
    if (!itemKey) continue;
    const k = budgetCsvDedupeKey(itemKey, tx.date, tx.amount);
    if (k) keysWithExpense.add(k);
    const dk = expenseCsvDetailDedupeKey(tx.date, tx.amount, tx.description);
    if (dk) keysByDetail.add(dk);
  }
  return { keysWithExpense, keysByDetail };
}

function descriptionsLikelyMatch(a, b) {
  const da = normalizeExpenseDescription(a);
  const db = normalizeExpenseDescription(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const minLen = 4;
  if (da.length < minLen || db.length < minLen) return false;
  return da.includes(db) || db.includes(da);
}

/** Same calendar day, amount, and matching budget line and/or description */
export function expenseRowsLikelyDuplicate(rowA, rowB) {
  const dA = normalizeDateForDedupe(rowA?.date);
  const dB = normalizeDateForDedupe(rowB?.date);
  if (!dA || !dB || dA !== dB) return false;
  const amtA = normalizeAmountForDedupe(rowA?.amount);
  const amtB = normalizeAmountForDedupe(rowB?.amount);
  if (amtA == null || amtB == null || amtA !== amtB) return false;

  const keyA = rowBudgetItemKey(rowA);
  const keyB = rowBudgetItemKey(rowB);
  if (keyA && keyB && keyA === keyB) return true;

  return descriptionsLikelyMatch(rowA?.description, rowB?.description);
}

function rowMatchesLoadedExpense(row, transactions) {
  for (const tx of transactions ?? []) {
    if (!transactionBudgetItemKey(tx)) continue;
    if (expenseRowsLikelyDuplicate(row, tx)) return true;
  }
  return false;
}

function isRowDuplicate(row, existing, batch, earlierCsvRows, transactions) {
  if (row.ignored) return false;
  if (row.budgetItemId) {
    const k = budgetCsvDedupeKey(row.budgetItemId, row.date, row.amount);
    if (k && (existing.keysWithExpense.has(k) || batch.keysWithExpense.has(k))) return true;
  }
  const dk = expenseCsvDetailDedupeKey(row.date, row.amount, row.description);
  if (dk && (existing.keysByDetail.has(dk) || batch.keysByDetail.has(dk))) return true;
  if (rowMatchesLoadedExpense(row, transactions)) return true;
  for (const prev of earlierCsvRows) {
    if (!prev.ignored && expenseRowsLikelyDuplicate(row, prev)) return true;
  }
  return false;
}

function addRowToBatchKeys(row, batch) {
  if (row.ignored) return;
  if (row.budgetItemId) {
    const k = budgetCsvDedupeKey(row.budgetItemId, row.date, row.amount);
    if (k) batch.keysWithExpense.add(k);
  }
  const dk = expenseCsvDetailDedupeKey(row.date, row.amount, row.description);
  if (dk) batch.keysByDetail.add(dk);
}

/**
 * Suggest expense budget lines and flag potential duplicates (existing DB + earlier CSV rows).
 * @param {object[]} rows parsed CSV rows (mutated)
 * @param {object[]} transactions all loaded transactions
 * @param {Set<string>|string[]} validBudgetItemKeys expense (e:id) and insurance (i:id) budget line keys
 */
export function enrichCsvExpenseRows(rows, transactions, validBudgetItemKeys) {
  const valid = validBudgetItemKeys instanceof Set ? validBudgetItemKeys : new Set(validBudgetItemKeys ?? []);
  const suggestionMap = buildExpenseIdSuggestionMap(transactions);
  const existing = buildExistingExpenseDedupeSets(transactions);
  const batch = { keysWithExpense: new Set(), keysByDetail: new Set() };
  const earlierCsvRows = [];

  for (const row of rows) {
    const suggested = suggestExpenseBudgetItemId(row.description, suggestionMap, valid);
    if (suggested && (!row.budgetItemId || !valid.has(String(row.budgetItemId)))) {
      row.budgetItemId = suggested;
    }

    const duplicate = isRowDuplicate(row, existing, batch, earlierCsvRows, transactions);
    row.csvPotentialDuplicate = !!duplicate;
    if (!row.csvImported) {
      row.csvDuplicateSkipped = !!duplicate;
    }

    addRowToBatchKeys(row, batch);
    earlierCsvRows.push(row);
  }

  return rows.map((r) => ({ ...r }));
}

/** Re-apply duplicate flags after user changes expense item on a row */
export function applyCsvDuplicateFlags(rows, transactions) {
  const existing = buildExistingExpenseDedupeSets(transactions);
  const batch = { keysWithExpense: new Set(), keysByDetail: new Set() };
  const earlierCsvRows = [];

  for (const row of rows) {
    if (row.ignored) {
      row.csvPotentialDuplicate = false;
      if (!row.csvImported) row.csvDuplicateSkipped = false;
      continue;
    }
    const duplicate = isRowDuplicate(row, existing, batch, earlierCsvRows, transactions);
    row.csvPotentialDuplicate = !!duplicate;
    if (!row.csvImported) {
      row.csvDuplicateSkipped = !!duplicate;
    }
    addRowToBatchKeys(row, batch);
    earlierCsvRows.push(row);
  }
}
