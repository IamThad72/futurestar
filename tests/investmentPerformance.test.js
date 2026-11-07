import assert from "node:assert/strict";
import test from "node:test";
import { formatInvestmentShares, truncateDescription } from "../utils/investmentFormat.js";
import { isQuotedSymbol, latestDailyClose } from "../utils/investmentQuotes.js";
import {
  accountValueStack,
  gainFromTotals,
  holdingMetrics,
  marketValueAfterEdit,
  parseOptionalAmount,
  portfolioMetrics,
  shareOfPortfolioGain,
  sortHoldings,
} from "../utils/investmentPerformance.js";
import { investmentHoldings, rollupAccountHoldings } from "../utils/investmentHoldings.js";

const sample = [
  { id: "a", name: "Investment A", ticker: "A", costBasis: 10000, currentValue: 12500 },
  { id: "b", name: "Investment B", ticker: "B", costBasis: 8000, currentValue: 7200 },
  { id: "c", name: "Investment C", ticker: "C", costBasis: 5000, currentValue: 6000 },
];

test("holding gain, loss, and unchanged amounts", () => {
  const gain = holdingMetrics(sample[0]);
  assert.equal(gain.gainDollars, 2500);
  assert.equal(gain.gainPercent, 25);
  assert.equal(gain.status, "gain");

  const loss = holdingMetrics(sample[1]);
  assert.equal(loss.gainDollars, -800);
  assert.equal(loss.gainPercent, -10);
  assert.equal(loss.status, "loss");

  const flat = holdingMetrics({ id: "flat", name: "Flat", costBasis: 100, currentValue: 100 });
  assert.equal(flat.gainDollars, 0);
  assert.equal(flat.gainPercent, 0);
  assert.equal(flat.status, "unchanged");
});

test("portfolio totals use the net gain divided by total cost, not an average of percentages", () => {
  const totals = portfolioMetrics(sample);
  assert.equal(totals.costBasis, 23000);
  assert.equal(totals.currentValue, 25700);
  assert.equal(totals.gainDollars, 2700);
  assert.ok(Math.abs(totals.gainPercent - (2700 / 23000) * 100) < 1e-9);
  const average = (25 + -10 + 20) / 3;
  assert.notEqual(totals.gainPercent, average);
  assert.equal(totals.included, 3);
  assert.equal(totals.excluded, 0);
});

test("zero cost basis yields N/A percentage and still reports the dollar change", () => {
  const metrics = holdingMetrics({ id: "zero", name: "Zero", costBasis: 0, currentValue: 500 });
  assert.equal(metrics.gainDollars, 500);
  assert.equal(metrics.gainPercent, null);
  assert.equal(metrics.status, "gain");

  const totals = portfolioMetrics([
    { id: "zero", name: "Zero", costBasis: 0, currentValue: 500 },
  ]);
  assert.equal(totals.costBasis, 0);
  assert.equal(totals.currentValue, 500);
  assert.equal(totals.gainDollars, 500);
  assert.equal(totals.gainPercent, null);
});

test("missing or invalid numbers are excluded instead of treated as zero", () => {
  const missing = holdingMetrics({ id: "m", name: "Missing", costBasis: null, currentValue: 1000 });
  assert.equal(missing.gainDollars, null);
  assert.equal(missing.costBasis, null);

  const invalid = holdingMetrics({ id: "bad", name: "Bad", costBasis: "10000", currentValue: 12500 });
  assert.equal(invalid.gainDollars, null);

  const totals = portfolioMetrics([
    ...sample,
    { id: "m", name: "Missing", costBasis: null, currentValue: 1000 },
    { id: "nan", name: "Nan", costBasis: Number.NaN, currentValue: 10 },
  ]);
  assert.equal(totals.costBasis, 23000);
  assert.equal(totals.currentValue, 25700);
  assert.equal(totals.excluded, 2);
});

test("empty portfolio does not report zero totals", () => {
  const totals = portfolioMetrics([]);
  assert.equal(totals.costBasis, null);
  assert.equal(totals.currentValue, null);
  assert.equal(totals.gainDollars, null);
  assert.equal(totals.gainPercent, null);
});

test("share of portfolio gain can be negative or above 100, and is N/A when net gain is zero", () => {
  const totals = portfolioMetrics(sample);
  const shareA = shareOfPortfolioGain(sample[0], totals);
  assert.ok(Math.abs(shareA - (2500 / 2700) * 100) < 1e-9);

  const offset = portfolioMetrics([
    { id: "up", name: "Up", costBasis: 1000, currentValue: 6000 },
    { id: "down", name: "Down", costBasis: 5000, currentValue: 1000 },
  ]);
  const shareUp = shareOfPortfolioGain({ id: "up", name: "Up", costBasis: 1000, currentValue: 6000 }, offset);
  assert.ok(shareUp > 100);

  const flat = portfolioMetrics([
    { id: "a", name: "A", costBasis: 100, currentValue: 150 },
    { id: "b", name: "B", costBasis: 100, currentValue: 50 },
  ]);
  assert.equal(flat.gainDollars, 0);
  assert.equal(shareOfPortfolioGain({ id: "a", name: "A", costBasis: 100, currentValue: 150 }, flat), null);
});

test("sorting by value, gain, percentage, and name keeps a stable order", () => {
  const byValue = sortHoldings(sample, "currentValue", "desc").map((row) => row.id);
  assert.deepEqual(byValue, ["a", "b", "c"]);

  const byGain = sortHoldings(sample, "gainDollars", "asc").map((row) => row.id);
  assert.deepEqual(byGain, ["b", "c", "a"]);

  const byPercent = sortHoldings(sample, "gainPercent", "asc").map((row) => row.id);
  assert.deepEqual(byPercent, ["b", "c", "a"]);

  const byName = sortHoldings(sample, "name", "asc").map((row) => row.id);
  assert.deepEqual(byName, ["a", "b", "c"]);

  const withMissing = sortHoldings(
    [...sample, { id: "m", name: "Missing", costBasis: null, currentValue: 99999 }],
    "gainDollars",
    "desc",
  );
  assert.equal(withMissing.at(-1).id, "m");
});

test("HSA Investments roll up into one category and HSA Cash stays separate", () => {
  const rolled = rollupAccountHoldings(investmentHoldings, "HSA Investments");
  const hsa = rolled.filter((holding) => holding.account === "HSA Investments");
  const members = investmentHoldings.filter((holding) => holding.account === "HSA Investments");
  assert.equal(hsa.length, 1);
  assert.equal(hsa[0].name, "HSA Investments");
  assert.equal(hsa[0].costBasis, null);
  assert.equal(hsa[0].currentValue, members.reduce((sum, holding) => sum + holding.currentValue, 0));
  assert.equal(rolled.length, investmentHoldings.length - members.length + 1);
  assert.equal(rolled.find((holding) => holding.id === "hsa-cash-fdrxx").currentValue, 1920.68);
});

test("account rollup does not treat a missing amount as zero", () => {
  const rolled = rollupAccountHoldings(
    [
      { id: "a", name: "A", account: "HSA Investments", costBasis: 10, currentValue: 12 },
      { id: "b", name: "B", account: "HSA Investments", costBasis: null, currentValue: 5 },
      { id: "c", name: "Cash", account: "HSA Cash", costBasis: 3, currentValue: 3 },
    ],
    "HSA Investments",
  );
  assert.equal(rolled.length, 2);
  assert.equal(rolled[0].name, "HSA Investments");
  assert.equal(rolled[0].costBasis, null);
  assert.equal(rolled[0].currentValue, 17);
  assert.equal(rolled[1].id, "c");
});

test("shares sort with missing counts last and do not change gain math", () => {
  const rows = [
    { id: "none", name: "None", costBasis: 10, currentValue: 12 },
    { id: "few", name: "Few", shares: 2, costBasis: 10, currentValue: 12 },
    { id: "many", name: "Many", shares: 20, costBasis: 10, currentValue: 12 },
  ];
  assert.deepEqual(sortHoldings(rows, "shares", "desc").map((row) => row.id), ["many", "few", "none"]);
  assert.equal(holdingMetrics(rows[1]).gainDollars, 2);
  assert.equal(formatInvestmentShares(2608), "2,608");
  assert.equal(formatInvestmentShares(130.587), "130.587");
  assert.equal(formatInvestmentShares(null), "N/A");
  assert.equal(truncateDescription("Fidelity 500 Index Fund"), "Fidelity…");
  assert.equal(truncateDescription("Held in FCASH"), "Held in…");
  assert.equal(truncateDescription("AT&T Inc"), "AT&T Inc");
});

test("blank amounts stay unknown and invalid text is rejected", () => {
  assert.deepEqual(parseOptionalAmount(""), { ok: true, value: null });
  assert.deepEqual(parseOptionalAmount("  "), { ok: true, value: null });
  assert.deepEqual(parseOptionalAmount("1,608.5"), { ok: true, value: 1608.5 });
  assert.equal(parseOptionalAmount("abc").ok, false);
  assert.equal(parseOptionalAmount("12 shares").ok, false);
});

test("price or share edits reprice the position and leave a stated value otherwise", () => {
  const priced = { shares: 10, price: 5, currentValue: 40 };
  assert.equal(marketValueAfterEdit(null, priced), 50);
  assert.equal(marketValueAfterEdit({ shares: 10, price: 4, currentValue: 40 }, priced), 50);
  assert.equal(marketValueAfterEdit({ shares: 10, price: 5, currentValue: 40 }, priced), 40);
  assert.equal(marketValueAfterEdit(null, { shares: null, price: null, currentValue: 1920.68 }), 1920.68);
  assert.equal(marketValueAfterEdit(null, { shares: 10, price: null, currentValue: 80 }), 80);
});

test("account and portfolio gain are current value minus cost basis", () => {
  const gainOnly = accountValueStack([{ costBasis: 100, currentValue: 125 }]);
  assert.equal(gainOnly.base, 100);
  assert.equal(gainOnly.gain, 25);
  assert.equal(gainOnly.loss, 0);
  assert.equal(gainOnly.costBasis, 100);
  assert.deepEqual(gainFromTotals(100, 125), { gainDollars: 25, gainPercent: 25 });

  const lossOnly = accountValueStack([{ costBasis: 100, currentValue: 80 }]);
  assert.equal(lossOnly.base, 80);
  assert.equal(lossOnly.gain, 0);
  assert.equal(lossOnly.loss, 20);

  const cashOnly = accountValueStack([{ costBasis: null, currentValue: 50 }]);
  assert.equal(cashOnly.base, 50);
  assert.equal(cashOnly.gain, 0);
  assert.equal(cashOnly.loss, 0);
  assert.equal(cashOnly.costBasis, null);
  assert.deepEqual(gainFromTotals(null, 50), { gainDollars: null, gainPercent: null });

  const mixed = accountValueStack([
    { costBasis: 100, currentValue: 140 },
    { costBasis: 50, currentValue: 30 },
    { costBasis: null, currentValue: 10 },
    { costBasis: 20, currentValue: null },
  ]);
  assert.equal(mixed.base, 150);
  assert.equal(mixed.gain, 30);
  assert.equal(mixed.loss, 0);
  assert.equal(mixed.costBasis, 150);
  assert.equal(mixed.base + mixed.gain, 180);
  assert.equal(gainFromTotals(150, 180).gainDollars, 30);
  assert.equal(gainFromTotals(0, 180).gainPercent, null);
});

test("daily close parser accepts a close and skips cash symbols", () => {
  const parsed = latestDailyClose({
    "Time Series (Daily)": {
      "2026-10-29": { "4. close": "10.00" },
      "2026-10-30": { "4. close": "10.50" },
    },
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.date, "2026-10-30");
  assert.equal(parsed.close, "10.5");
  assert.equal(latestDailyClose({ Note: "rate limit" }).ok, false);
  assert.equal(latestDailyClose({ "Time Series (Daily)": {} }).ok, false);
  assert.equal(isQuotedSymbol("FXAIX"), true);
  assert.equal(isQuotedSymbol("SPAXX"), true);
  assert.equal(isQuotedSymbol("FCASH"), false);
  assert.equal(isQuotedSymbol("84679P306"), false);
});
