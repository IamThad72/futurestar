/** Shared helpers for splitting gross income across tax, insurance, retirement, savings, and investment budget lines. */

import { isGrossIncomeBudgetLine, isNetIncomeBudgetLine } from "./budgetChart.js";

export function grossAllocationKey(kind, id) {
  return `${kind}:${id}`;
}

export function parseGrossAllocationKey(key) {
  const i = String(key).indexOf(":");
  if (i < 0) return null;
  return { kind: key.slice(0, i), id: key.slice(i + 1) };
}

export function sumGrossAllocationAmounts(amountsByKey) {
  let total = 0;
  for (const v of Object.values(amountsByKey ?? {})) {
    const n = Number(v);
    if (!isNaN(n) && n > 0) total += n;
  }
  return Math.round(total * 100) / 100;
}

export function computeNetFromGross(gross, allocatedTotal) {
  const g = Number(gross);
  const a = Number(allocatedTotal);
  if (isNaN(g)) return 0;
  const alloc = isNaN(a) ? 0 : a;
  return Math.round((g - alloc) * 100) / 100;
}

export function isGrossIncomeBudgetItem(item) {
  return item != null && isGrossIncomeBudgetLine(item);
}

/** Net Income budget line (same category preferred; best sub-category label match wins). */
export function findNetIncomeBudgetLine(incomeItems, { category, excludeId } = {}) {
  let candidates = (incomeItems ?? []).filter((i) => isNetIncomeBudgetLine(i));
  if (excludeId != null) {
    candidates = candidates.filter((i) => String(i.id) !== String(excludeId));
  }
  if (!candidates.length) return null;

  const preferredCategory = category ? String(category).trim() : "";
  const score = (item) => {
    let s = 0;
    const cat = (item.category || "").trim();
    const sub = (item.sub_category || "").trim().toLowerCase();
    if (preferredCategory && cat === preferredCategory) s += 10;
    if (/\bnet\s+income\b/.test(sub)) s += 5;
    if (/\bnet\s+pay\b/.test(sub)) s += 4;
    if (sub === "net") s += 3;
    if (sub.includes("take home") || sub.includes("take-home")) s += 2;
    return s;
  };

  return [...candidates].sort((a, b) => score(b) - score(a))[0];
}

/** 401k, IRA, pension, etc. — shown as Retirement in gross income allocation (not under Savings/Investments) */
export function isRetirementBudgetLine(item) {
  const text = [item?.category, item?.sub_category, item?.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!text) return false;
  if (text.includes("retirement")) return true;
  if (/\b401\s*[\(\s-]*k\b/.test(text)) return true;
  if (/\b403\s*[\(\s-]*b\b/.test(text)) return true;
  if (/\b457\b/.test(text) && (text.includes("plan") || text.includes("defer"))) return true;
  if (/\bira\b/.test(text) || text.includes("roth ira") || text.includes("traditional ira")) return true;
  if (text.includes("pension")) return true;
  if (text.includes("tsp") || text.includes("thrift savings")) return true;
  return false;
}

function pushGroupLines(lines, groups, kind) {
  for (const g of groups ?? []) {
    for (const item of g.items ?? []) {
      lines.push({
        kind,
        id: String(item.id),
        category: g.category,
        sub_category: item.sub_category,
        item,
      });
    }
  }
}

/** Split savings/investment groups so retirement lines appear only under Retirement */
export function partitionSavingsInvestmentForGrossAlloc(savingsGroups, investmentGroups) {
  const retirementGroups = [];
  const savingsOut = [];
  const investmentsOut = [];

  const split = (groups, otherBucket) => {
    for (const g of groups ?? []) {
      const retirementItems = [];
      const otherItems = [];
      for (const item of g.items ?? []) {
        if (isRetirementBudgetLine(item)) retirementItems.push(item);
        else otherItems.push(item);
      }
      if (retirementItems.length) {
        retirementGroups.push({ category: g.category, items: retirementItems });
      }
      if (otherItems.length) {
        otherBucket.push({ category: g.category, items: otherItems });
      }
    }
  };

  split(savingsGroups, savingsOut);
  split(investmentGroups, investmentsOut);

  return {
    retirementGroups,
    savingsGroups: savingsOut,
    investmentGroups: investmentsOut,
  };
}

/** Flat list of tax / insurance / retirement / savings / investment budget lines for allocation UI */
export function buildGrossAllocatableLines(
  taxGroups,
  insuranceGroups,
  retirementGroups,
  savingsGroups,
  investmentGroups,
) {
  const lines = [];
  pushGroupLines(lines, taxGroups, "tax");
  pushGroupLines(lines, insuranceGroups, "insurance");
  pushGroupLines(lines, retirementGroups, "retirement");
  pushGroupLines(lines, savingsGroups, "savings");
  pushGroupLines(lines, investmentGroups, "investment");
  return lines;
}

export function getPositiveGrossAllocations(amountsByKey) {
  const out = [];
  for (const [key, raw] of Object.entries(amountsByKey ?? {})) {
    const amount = Math.round(Number(raw) * 100) / 100;
    if (isNaN(amount) || amount <= 0) continue;
    const parsed = parseGrossAllocationKey(key);
    if (!parsed) continue;
    out.push({ ...parsed, amount, key });
  }
  return out;
}
