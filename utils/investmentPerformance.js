/** Performance math for the Investments dashboard. Calculations stay full precision. */

export const investmentSortOptions = [
  { key: "currentValue", label: "Current value" },
  { key: "costBasis", label: "Cost basis" },
  { key: "gainDollars", label: "Unrealized gain/loss ($)" },
  { key: "gainPercent", label: "Unrealized gain/loss (%)" },
  { key: "name", label: "Investment name" },
  { key: "shares", label: "Shares" },
  { key: "price", label: "Price" },
];

export function defaultSortDirection(key) {
  return key === "name" ? "asc" : "desc";
}

export function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function sameStoredAmount(left, right) {
  if (left == null && right == null) return true;
  return isFiniteNumber(left) && isFiniteNumber(right) && left === right;
}

/**
 * Current value to store after an edit.
 * A change to shares or price sets value to shares times price.
 * Otherwise the saved value is kept, including a cash balance with no share count.
 * A missing price or share count is not treated as zero.
 */
export function marketValueAfterEdit(previous, next) {
  const shares = isFiniteNumber(next?.shares) ? next.shares : null;
  const price = isFiniteNumber(next?.price) ? next.price : null;
  const stated = isFiniteNumber(next?.currentValue) ? next.currentValue : null;
  const sharesChanged = !previous || !sameStoredAmount(isFiniteNumber(previous.shares) ? previous.shares : null, shares);
  const priceChanged = !previous || !sameStoredAmount(isFiniteNumber(previous.price) ? previous.price : null, price);
  if ((sharesChanged || priceChanged) && shares != null && price != null) {
    return Math.round(shares * price * 100) / 100;
  }
  return stated;
}

export function holdingLabel(holding) {
  const name = String(holding?.name || "").trim();
  const ticker = String(holding?.ticker || "").trim();
  if (name && ticker) return `${name} (${ticker})`;
  return name || ticker || String(holding?.id || "Investment");
}

/**
 * Gain/loss for one holding.
 * Percentage is null when cost basis is zero or either amount is missing or invalid.
 */
export function holdingMetrics(holding) {
  const costOk = isFiniteNumber(holding?.costBasis);
  const valueOk = isFiniteNumber(holding?.currentValue);
  if (!costOk || !valueOk) {
    return {
      costBasis: costOk ? holding.costBasis : null,
      currentValue: valueOk ? holding.currentValue : null,
      gainDollars: null,
      gainPercent: null,
      status: "invalid",
    };
  }
  const gainDollars = holding.currentValue - holding.costBasis;
  const gainPercent = holding.costBasis === 0 ? null : (gainDollars / holding.costBasis) * 100;
  const status = gainDollars > 0 ? "gain" : gainDollars < 0 ? "loss" : "unchanged";
  return {
    costBasis: holding.costBasis,
    currentValue: holding.currentValue,
    gainDollars,
    gainPercent,
    status,
  };
}

/** Portfolio totals from holdings that have both a valid cost basis and a valid current value. */
export function portfolioMetrics(holdings) {
  let costBasis = 0;
  let currentValue = 0;
  let included = 0;
  for (const holding of holdings ?? []) {
    const metrics = holdingMetrics(holding);
    if (metrics.gainDollars == null) continue;
    costBasis += metrics.costBasis;
    currentValue += metrics.currentValue;
    included += 1;
  }
  if (!included) {
    return {
      costBasis: null,
      currentValue: null,
      gainDollars: null,
      gainPercent: null,
      included: 0,
      excluded: (holdings ?? []).length,
    };
  }
  const gainDollars = currentValue - costBasis;
  const gainPercent = costBasis === 0 ? null : (gainDollars / costBasis) * 100;
  return {
    costBasis,
    currentValue,
    gainDollars,
    gainPercent,
    included,
    excluded: (holdings ?? []).length - included,
  };
}

/**
 * Unrealized gain from an account or portfolio total.
 * Dollars are current value minus cost basis. Percent is that gain divided by cost basis.
 * Null when either total is missing. A zero cost basis has a dollar gain and no percent.
 */
export function gainFromTotals(costBasis, currentValue) {
  if (!isFiniteNumber(costBasis) || !isFiniteNumber(currentValue)) {
    return { gainDollars: null, gainPercent: null };
  }
  const gainDollars = currentValue - costBasis;
  const gainPercent = costBasis === 0 ? null : (gainDollars / costBasis) * 100;
  return { gainDollars, gainPercent };
}

/**
 * Stacked-bar parts from account totals.
 * The cap is account current value minus account cost basis, the same figure as the account row.
 * Gray is the lower of those two totals. A missing cost basis leaves the bar as current value only.
 */
export function accountValueStack(rows) {
  const performance = portfolioMetrics(rows);
  let accountValue = 0;
  let hasValue = false;
  for (const row of rows ?? []) {
    const metrics = row?.metrics ?? holdingMetrics(row);
    if (!isFiniteNumber(metrics.currentValue)) continue;
    accountValue += metrics.currentValue;
    hasValue = true;
  }
  const costBasis = performance.costBasis;
  if (!hasValue) {
    return { base: 0, gain: 0, loss: 0, costBasis };
  }
  const { gainDollars } = gainFromTotals(costBasis, accountValue);
  if (!isFiniteNumber(gainDollars) || gainDollars === 0) {
    return { base: accountValue, gain: 0, loss: 0, costBasis };
  }
  if (gainDollars > 0) {
    return { base: accountValue - gainDollars, gain: gainDollars, loss: 0, costBasis };
  }
  return { base: accountValue, gain: 0, loss: -gainDollars, costBasis };
}

/**
 * Holding gain/loss as a share of the portfolio's net unrealized gain/loss.
 * Null when the portfolio net is zero, missing, or the holding has no gain/loss.
 * The result can be negative or above 100 when gains and losses offset.
 */
export function shareOfPortfolioGain(holding, portfolio) {
  if (!portfolio || !isFiniteNumber(portfolio.gainDollars) || portfolio.gainDollars === 0) return null;
  const metrics = holdingMetrics(holding);
  if (metrics.gainDollars == null) return null;
  return (metrics.gainDollars / portfolio.gainDollars) * 100;
}

function nameSortValue(holding) {
  return `${String(holding?.name || "").trim()} ${String(holding?.ticker || "").trim()} ${String(holding?.id || "")}`
    .trim()
    .toLocaleLowerCase();
}

function numericSortValue(holding, key) {
  if (key === "shares") return isFiniteNumber(holding?.shares) ? holding.shares : null;
  if (key === "price") return isFiniteNumber(holding?.price) ? holding.price : null;
  const metrics = holdingMetrics(holding);
  if (key === "currentValue") return isFiniteNumber(metrics.currentValue) ? metrics.currentValue : null;
  if (key === "costBasis") return isFiniteNumber(metrics.costBasis) ? metrics.costBasis : null;
  if (key === "gainDollars") return metrics.gainDollars;
  if (key === "gainPercent") return metrics.gainPercent;
  return null;
}

/** Blank stays unknown. Invalid text is rejected instead of becoming zero. */
export function parseOptionalAmount(raw) {
  if (raw == null) return { ok: true, value: null };
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? { ok: true, value: raw } : { ok: false, value: null };
  }
  const text = String(raw).trim().replace(/[$,]/g, "");
  if (!text) return { ok: true, value: null };
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(text)) return { ok: false, value: null };
  const value = Number(text);
  return Number.isFinite(value) ? { ok: true, value } : { ok: false, value: null };
}

export function sortHoldings(holdings, key, direction = "desc") {
  const dir = direction === "asc" ? 1 : -1;
  return [...(holdings ?? [])].sort((a, b) => {
    if (key === "name") {
      return nameSortValue(a).localeCompare(nameSortValue(b)) * (direction === "desc" ? -1 : 1);
    }
    const av = numericSortValue(a, key);
    const bv = numericSortValue(b, key);
    const aMissing = av == null;
    const bMissing = bv == null;
    if (aMissing && bMissing) return nameSortValue(a).localeCompare(nameSortValue(b));
    if (aMissing) return 1;
    if (bMissing) return -1;
    if (av === bv) return nameSortValue(a).localeCompare(nameSortValue(b));
    return (av - bv) * dir;
  });
}
