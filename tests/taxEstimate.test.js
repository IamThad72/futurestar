import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { summarizeBudgetIncome } from "../utils/tax/budgetIncome.js";
import { estimateTax } from "../utils/tax/estimate.js";

function walk(dir, found = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "node_modules" || name === ".git") continue;
      walk(path, found);
    } else if (/\.(js|vue|ts|mjs)$/.test(name)) {
      found.push(path);
    }
  }
  return found;
}

test("budget gross pay is the income source, not a separate $50,000 snapshot", () => {
  const totals = summarizeBudgetIncome([
    {
      income_type: "gross",
      category: "Pay",
      sub_category: "Salary",
      monthly_amount: 6250,
      annual_amount: 75000,
    },
    {
      income_type: "interest",
      category: "Pay",
      sub_category: "Savings interest",
      monthly_amount: 18,
      annual_amount: 216,
    },
    { income_type: "tax", category: "Tax", sub_category: "Federal", annual_amount: 9000 },
    { income_type: "deduction", category: "Deduction", sub_category: "401k", annual_amount: 4500 },
    {
      income_type: "gross",
      category: "Business",
      sub_category: "1099 consulting",
      annual_amount: 12000,
    },
    { income_type: "other", category: "Retirement", sub_category: "Pension", annual_amount: 8000 },
  ]);
  assert.equal(totals.wages, 75000);
  assert.equal(totals.self_employment, 12000);
  assert.equal(totals.retirement, 8000);
  assert.equal(totals.other_income, 216);
  assert.notEqual(totals.wages, 50000);
});

test("a saved $50,000 wage is replaced when the profile follows budget income", () => {
  const result = estimateTax({
    year: 2026,
    useBudgetIncome: true,
    profile: { filingStatus: "single", stateCode: "FL", wages: 50000 },
    budgetIncome: { wages: 75000, self_employment: 0, retirement: 0, other_income: 216 },
  });
  assert.equal(result.incomeSource, "budget");
  assert.equal(result.federal.wages, 75000);
  assert.equal(result.federal.otherIncome, 216);
  assert.equal(result.federal.grossIncome, 75216);
});

test("2026 filing statuses use their own brackets and standard deductions", () => {
  const single = estimateTax({
    year: 2026,
    profile: { filingStatus: "single", stateCode: "FL", wages: 100000 },
  });
  const joint = estimateTax({
    year: 2026,
    profile: { filingStatus: "married_filing_jointly", stateCode: "FL", wages: 100000 },
  });
  const separate = estimateTax({
    year: 2026,
    profile: { filingStatus: "married_filing_separately", stateCode: "FL", wages: 100000 },
  });
  const head = estimateTax({
    year: 2026,
    profile: { filingStatus: "head_of_household", stateCode: "FL", wages: 100000 },
  });
  const surviving = estimateTax({
    year: 2026,
    profile: { filingStatus: "qualifying_surviving_spouse", stateCode: "FL", wages: 100000 },
  });

  assert.equal(single.federal.deduction, 16100);
  assert.equal(single.federal.taxBeforeCredits, 13170);
  assert.equal(single.federal.marginalRate, 0.22);

  assert.equal(joint.federal.deduction, 32200);
  assert.equal(joint.federal.taxBeforeCredits, 7640);
  assert.equal(joint.federal.marginalRate, 0.12);

  assert.equal(separate.federal.deduction, 16100);
  assert.equal(separate.federal.taxBeforeCredits, 13170);
  assert.equal(separate.federal.marginalRate, 0.22);

  assert.equal(head.federal.deduction, 24150);
  assert.equal(head.federal.taxBeforeCredits, 9588);
  assert.equal(head.federal.marginalRate, 0.22);

  assert.equal(surviving.federal.deduction, 32200);
  assert.equal(surviving.federal.taxBeforeCredits, joint.federal.taxBeforeCredits);
});

test("2025 standard deduction is the OBBBA amount, not the earlier $15,000 figure", () => {
  const result = estimateTax({
    year: 2025,
    profile: { filingStatus: "single", stateCode: "FL", wages: 20000 },
  });
  assert.equal(result.federal.rulesYear, 2025);
  assert.equal(result.federal.deduction, 15750);
  assert.equal(result.federal.taxableIncome, 4250);
  assert.equal(result.federal.taxBeforeCredits, 425);
});

test("child tax credit, other dependent credit, and phaseout", () => {
  const low = estimateTax({
    year: 2026,
    profile: { filingStatus: "single", stateCode: "TX", wages: 20000, childrenUnder17: 1 },
  });
  assert.equal(low.federal.taxBeforeCredits, 390);
  assert.equal(low.federal.incomeTax, 0);
  assert.equal(low.federal.credits.refundable, 1700);
  assert.equal(low.federal.totalTax, -1700);

  const other = estimateTax({
    year: 2026,
    profile: { filingStatus: "single", stateCode: "TX", wages: 50000, otherDependents: 1 },
  });
  assert.equal(other.federal.credits.otherDependentCreditMax, 500);
  assert.equal(other.federal.credits.refundable, 0);
  assert.equal(other.federal.incomeTax, 3320);

  const phased = estimateTax({
    year: 2026,
    profile: {
      filingStatus: "married_filing_jointly",
      stateCode: "TX",
      wages: 401000,
      childrenUnder17: 1,
    },
  });
  assert.equal(phased.federal.credits.phaseoutReduction, 50);
  assert.equal(phased.federal.credits.creditAfterPhaseout, 2150);
});

test("self-employment tax, wage base, and additional Medicare", () => {
  const only = estimateTax({
    year: 2026,
    profile: { filingStatus: "single", stateCode: "FL", selfEmployment: 10000 },
  });
  assert.equal(only.federal.selfEmployment.netEarnings, 9235);
  assert.equal(only.federal.selfEmployment.socialSecurityTax, 1145.14);
  assert.equal(only.federal.selfEmployment.medicareTax, 267.82);
  assert.equal(only.federal.selfEmployment.additionalMedicareTax, 0);
  assert.equal(only.federal.selfEmployment.deductibleHalf, 706.48);
  assert.equal(only.federal.selfEmployment.total, 1412.96);
  assert.equal(only.federal.agi, 9293.52);
  assert.equal(only.federal.taxableIncome, 0);
  assert.equal(only.federal.marginalRate, 0);
  assert.equal(only.federal.totalTax, 1412.96);

  const additional = estimateTax({
    year: 2026,
    profile: { filingStatus: "single", stateCode: "FL", wages: 200000, selfEmployment: 10000 },
  });
  assert.equal(additional.federal.selfEmployment.socialSecurityTax, 0);
  assert.equal(additional.federal.selfEmployment.medicareTax, 267.82);
  assert.equal(additional.federal.selfEmployment.additionalMedicareTax, 83.12);
  assert.equal(additional.federal.selfEmployment.deductibleHalf, 133.91);
  assert.equal(additional.federal.agi, 209866.09);
});

test("a no-income-tax state estimates zero and an unmodeled state does not invent a number", () => {
  const florida = estimateTax({
    year: 2026,
    profile: { filingStatus: "single", stateCode: "FL", wages: 80000 },
  });
  assert.equal(florida.state.available, true);
  assert.equal(florida.state.kind, "none");
  assert.equal(florida.state.tax, 0);
  assert.match(florida.state.message, /no tax/i);

  const california = estimateTax({
    year: 2026,
    profile: { filingStatus: "single", stateCode: "CA", wages: 80000 },
  });
  assert.equal(california.state.available, false);
  assert.equal(california.state.kind, "unavailable");
  assert.equal(california.state.tax, 0);
  assert.equal(california.state.message, "State estimate not yet available for California.");
});

test("an itemized deduction replaces the standard deduction", () => {
  const result = estimateTax({
    year: 2026,
    profile: {
      filingStatus: "single",
      stateCode: "FL",
      wages: 100000,
      deductionMethod: "itemized",
      itemizedDeduction: 20000,
    },
  });
  assert.equal(result.federal.deductionMethod, "itemized");
  assert.equal(result.federal.deduction, 20000);
  assert.equal(result.federal.taxableIncome, 80000);
});

test("flat tax uses the year's rate, deduction, and exemption", () => {
  const illinois = estimateTax({
    year: 2026,
    profile: { filingStatus: "single", stateCode: "IL", wages: 50000 },
  });
  assert.equal(illinois.state.kind, "flat");
  assert.equal(illinois.state.detail.taxableIncome, 47075);
  assert.equal(illinois.state.tax, 2330.21);

  const indiana2025 = estimateTax({
    year: 2025,
    profile: { filingStatus: "single", stateCode: "IN", wages: 10000 },
  });
  const indiana2026 = estimateTax({
    year: 2026,
    profile: { filingStatus: "single", stateCode: "IN", wages: 10000 },
  });
  assert.equal(indiana2025.state.tax, 270);
  assert.equal(indiana2026.state.tax, 265.5);
});

test("Ohio plus a 1.5% local rate reproduces the previous Wooster-area result", () => {
  // Previous federal and Ohio estimates started from income after pre-tax ($43,944 on the
  // old $50,000 fiscal snapshot). Local tax used qualifying wages of $46,944 at 1.5%.
  const federalAndOhio = estimateTax({
    year: 2026,
    profile: {
      filingStatus: "married_filing_jointly",
      stateCode: "OH",
      deductionMethod: "standard",
      childrenUnder17: 1,
      wages: 43944,
      localRate: 0.015,
    },
    withheld: { federal: 6000, state: 2000, local: 750 },
  });
  assert.equal(federalAndOhio.federal.agi, 43944);
  assert.equal(federalAndOhio.federal.deduction, 32200);
  assert.equal(federalAndOhio.federal.taxableIncome, 11744);
  assert.equal(federalAndOhio.federal.taxBeforeCredits, 1174.4);
  assert.equal(federalAndOhio.federal.incomeTax, 0);
  assert.equal(federalAndOhio.federal.credits.refundable, 1025.6);
  assert.equal(federalAndOhio.federal.totalTax, -1025.6);
  assert.equal(federalAndOhio.federal.balance, -7025.6);
  assert.equal(federalAndOhio.state.kind, "ohio");
  assert.equal(federalAndOhio.state.detail.exemptionPerPerson, 2100);
  assert.equal(federalAndOhio.state.detail.exemptionCount, 3);
  assert.equal(federalAndOhio.state.detail.personalExemptions, 6300);
  assert.equal(federalAndOhio.state.detail.taxableIncome, 37644);
  assert.equal(federalAndOhio.state.detail.taxBeforeCredits, 650.84);
  assert.equal(federalAndOhio.state.detail.jointFilingCredit, 97.63);
  assert.equal(federalAndOhio.state.tax, 553.21);
  assert.equal(federalAndOhio.state.balance, -1446.79);

  const local = estimateTax({
    year: 2026,
    profile: {
      filingStatus: "single",
      stateCode: "OH",
      wages: 46944,
      localRate: 0.015,
    },
    withheld: { local: 750 },
  });
  assert.equal(local.local.base, 46944);
  assert.equal(local.local.rate, 0.015);
  assert.equal(local.local.tax, 704.16);
  assert.equal(local.local.balance, -45.84);
});

test("later years keep the newest published rules and say so", () => {
  const result = estimateTax({
    year: 2030,
    profile: { filingStatus: "single", stateCode: "FL", wages: 40000 },
  });
  assert.equal(result.federal.rulesYear, 2026);
  assert.equal(result.federal.usingPriorYearRules, true);
  assert.equal(result.federal.deduction, 16100);
});

test("estimator source does not hard-code a city, ZIP, or filing scenario", () => {
  const roots = ["utils", "pages/tax", "components", "server", "data/tax"].map((dir) => join(process.cwd(), dir));
  const hits = [];
  for (const root of roots) {
    for (const file of walk(root)) {
      if (file.endsWith("taxEstimate.test.js") || file.endsWith(`${join("data", "tax", "README.md")}`)) continue;
      const text = readFileSync(file, "utf8");
      if (/Wooster|44691/.test(text)) hits.push(file);
    }
  }
  assert.deepEqual(hits, []);
});
