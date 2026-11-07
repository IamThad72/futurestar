/** Browser copy of edited holdings. */

import { isFiniteNumber } from "./investmentPerformance.js";

const STORAGE_PREFIX = "myfin.investment-holdings.2026-10-31.";

function storageKey(userId) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function normalizeHolding(row, index = 0) {
  if (!row || typeof row !== "object") return null;
  const name = String(row.name || "").trim();
  if (!name) return null;
  return {
    id: String(row.id || `holding-${index + 1}`),
    name,
    ticker: String(row.ticker || "").trim(),
    account: String(row.account || "").trim(),
    shares: isFiniteNumber(row.shares) ? row.shares : null,
    price: isFiniteNumber(row.price) ? row.price : null,
    costBasis: isFiniteNumber(row.costBasis) ? row.costBasis : null,
    currentValue: isFiniteNumber(row.currentValue) ? row.currentValue : null,
  };
}

export function readSavedHoldings(userId) {
  if (userId == null || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw == null) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((row, index) => normalizeHolding(row, index)).filter(Boolean);
  } catch {
    return null;
  }
}

export function saveHoldings(userId, holdings) {
  if (userId == null || typeof localStorage === "undefined") return;
  const rows = (holdings ?? []).map((row, index) => normalizeHolding(row, index)).filter(Boolean);
  localStorage.setItem(storageKey(userId), JSON.stringify(rows));
}

