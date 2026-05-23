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

function pickMostCommonExpenseId(countById) {
  let best = "";
  let bestCount = 0;
  for (const [id, count] of countById.entries()) {
    if (count > bestCount) {
      bestCount = count;
      best = id;
    }
  }
  return best;
}

/** norm description -> Map<expenseId, count> from past expense transactions */
export function buildExpenseIdSuggestionMap(transactions) {
  const byDesc = new Map();
  for (const tx of transactions ?? []) {
    if (tx.type !== "expense" || tx.expense_id == null) continue;
    const norm = normalizeExpenseDescription(tx.description);
    if (!norm) continue;
    const eid = String(tx.expense_id);
    if (!byDesc.has(norm)) byDesc.set(norm, new Map());
    const inner = byDesc.get(norm);
    inner.set(eid, (inner.get(eid) || 0) + 1);
  }
  return byDesc;
}

export function suggestExpenseBudgetItemId(description, suggestionMap, validExpenseIds) {
  const valid = validExpenseIds instanceof Set ? validExpenseIds : new Set(validExpenseIds ?? []);
  const norm = normalizeExpenseDescription(description);
  if (!norm || !suggestionMap?.size) return "";

  const pickValid = (countMap) => {
    const id = pickMostCommonExpenseId(countMap);
    return id && valid.has(id) ? id : "";
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
  const eid = parseInt(String(expenseId), 10);
  if (isNaN(eid) || eid <= 0) return null;
  const d = normalizeDateForDedupe(dateStr);
  if (!d) return null;
  const amt = normalizeAmountForDedupe(amount);
  if (amt == null) return null;
  return `e:${eid}|${d}|${amt}`;
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
    const isExpense =
      tx.type === "expense" || (tx.expense_id != null && tx.income_id == null);
    if (!isExpense || tx.expense_id == null) continue;
    const k = expenseCsvDedupeKey(tx.expense_id, tx.date, tx.amount);
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

  const eidA = rowA?.budgetItemId != null && rowA.budgetItemId !== ""
    ? parseInt(String(rowA.budgetItemId), 10)
    : rowA?.expense_id != null
      ? parseInt(String(rowA.expense_id), 10)
      : null;
  const eidB = rowB?.budgetItemId != null && rowB.budgetItemId !== ""
    ? parseInt(String(rowB.budgetItemId), 10)
    : rowB?.expense_id != null
      ? parseInt(String(rowB.expense_id), 10)
      : null;
  if (eidA && eidB && !isNaN(eidA) && !isNaN(eidB) && eidA === eidB) return true;

  return descriptionsLikelyMatch(rowA?.description, rowB?.description);
}

function rowMatchesLoadedExpense(row, transactions) {
  for (const tx of transactions ?? []) {
    const isExpense =
      tx.type === "expense" || (tx.expense_id != null && tx.income_id == null);
    if (!isExpense || tx.expense_id == null) continue;
    if (expenseRowsLikelyDuplicate(row, tx)) return true;
  }
  return false;
}

function isRowDuplicate(row, existing, batch, earlierCsvRows, transactions) {
  if (row.ignored) return false;
  if (row.budgetItemId) {
    const k = expenseCsvDedupeKey(row.budgetItemId, row.date, row.amount);
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
    const k = expenseCsvDedupeKey(row.budgetItemId, row.date, row.amount);
    if (k) batch.keysWithExpense.add(k);
  }
  const dk = expenseCsvDetailDedupeKey(row.date, row.amount, row.description);
  if (dk) batch.keysByDetail.add(dk);
}

/**
 * Suggest expense budget lines and flag potential duplicates (existing DB + earlier CSV rows).
 * @param {object[]} rows parsed CSV rows (mutated)
 * @param {object[]} transactions all loaded transactions
 * @param {Set<string>|string[]} validExpenseIds expense budget line ids (expense_type expense)
 */
export function enrichCsvExpenseRows(rows, transactions, validExpenseIds) {
  const valid = validExpenseIds instanceof Set ? validExpenseIds : new Set(validExpenseIds ?? []);
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
