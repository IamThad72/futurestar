import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { estimateFederalTaxMfjStandardOneChild } from "../utils/federalTaxEstimate.js";
import { estimateWoosterLocalTax, woosterQualifyingWages } from "../utils/ohioLocalTaxEstimate.js";
import { estimateOhioTaxMfjOneDependent } from "../utils/ohioTaxEstimate.js";
import {
  classifyFiscalIncomeKind,
  classifyFiscalPosttaxKind,
  classifyFiscalPretaxKind,
} from "../utils/annualTotals.js";
import { isMissingRelationError } from "../utils/tax/dbErrors.js";
import {
  classifyDeductionType,
  deductionTypes,
  wageBases,
} from "../utils/tax/deductions.js";
import { estimateHouseholdTax } from "../utils/tax/estimate.js";
import { roundMoney } from "../utils/tax/money.js";
import { TAX_ESTIMATE_DISCLAIMER, buildTaxPageModel } from "../utils/tax/pageModel.js";
import { projectFullYear, summarizeBudgetPlan } from "../utils/tax/project.js";
import { getFederalRules, getStateRules } from "../utils/tax/rules.js";

const OWNER = {
  filing_status: "married_filing_jointly",
  state_code: "OH",
  children_under_17: 1,
  other_dependents: 0,
  deduction_method: "standard",
  local_jurisdiction: "Wooster",
  local_county: "Wayne County",
  local_zip: "44691",
  school_district: "Wooster CSD",
  city_rate: 0.015,
  school_district_rate: 0,
};

const GROSS = 50000;
const DEDUCTIONS = { medical: 2000, dental: 500, vision: 200, hsa: 356, "401k": 3000 };
const WITHHELD = { federal: 2000, state: 400, local: 300, medicare: 100, social_security: 500 };

test("owner profile matches the old tax page for 2026 and later years that reuse it", () => {
  const incomeAfterPretax = 43944;
  const qualifying = woosterQualifyingWages({
    gross: GROSS,
    medical: DEDUCTIONS.medical,
    dental: DEDUCTIONS.dental,
    vision: DEDUCTIONS.vision,
    hsa: DEDUCTIONS.hsa,
    taxableFallback: incomeAfterPretax,
  });
  assert.equal(qualifying, 46944);

  for (const year of [2026, 2027]) {
    const oldFederal = estimateFederalTaxMfjStandardOneChild({
      incomeAfterPretax,
      federalWithheld: WITHHELD.federal,
      year,
    });
    const oldOhio = estimateOhioTaxMfjOneDependent({
      incomeAfterPretax,
      stateWithheld: WITHHELD.state,
      year,
    });
    const oldLocal = estimateWoosterLocalTax({
      qualifyingWages: qualifying,
      localWithheld: WITHHELD.local,
    });
    const next = estimateHouseholdTax({
      year,
      profile: OWNER,
      gross: GROSS,
      deductions: DEDUCTIONS,
      withheld: WITHHELD,
    });

    assert.equal(next.profileMissing, false);
    assert.equal(next.wages.box1, oldFederal.incomeAfterPretax);
    assert.equal(next.wages.localWages, oldLocal.qualifyingWages);
    assert.equal(next.federal.taxBeforeCredits, oldFederal.taxBeforeCredits);
    assert.equal(next.federal.taxableIncome, oldFederal.taxableIncome);
    assert.equal(next.federal.childTaxCredit, oldFederal.childTaxCredit);
    assert.equal(next.federal.refundableChildTaxCredit, oldFederal.refundableChildTaxCredit);
    assert.equal(next.federal.estimatedTax, oldFederal.estimatedFederalTax);
    assert.equal(next.federal.balance, oldFederal.balance);
    assert.equal(next.state.estimatedTax, oldOhio.estimatedOhioTax);
    assert.equal(next.state.balance, oldOhio.balance);
    assert.equal(next.state.detail.exemptionCount, oldOhio.exemptionCount);
    assert.equal(next.state.detail.personalExemptions, oldOhio.personalExemptions);
    assert.equal(next.state.detail.jointFilingCredit, oldOhio.jointFilingCredit);
    assert.equal(next.local.estimatedTax, oldLocal.estimatedLocalTax);
    assert.equal(next.local.estimatedTax, 704.16);
    assert.equal(next.local.balance, oldLocal.balance);
    assert.equal(next.local.city, "Wooster");
    assert.equal(next.local.schoolDistrict, "Wooster CSD");
    assert.ok(next.federal.rows.some((row) => row.label === "Income after pre-tax" && row.amount === incomeAfterPretax));
    assert.ok(next.state.rows.some((row) => row.label === "Ohio AGI (after pre-tax)"));
  }
});

test("Section 125 reduces FICA wages and traditional 401(k) does not", () => {
  const bases = wageBases({
    gross: 100000,
    deductions: { medical: 5000, fsa: 1000, "401k": 10000 },
    stateCode: "OH",
    socialSecurityWageBase: 184500,
  });
  assert.equal(bases.box1, 84000);
  assert.equal(bases.box3, 94000);
  assert.equal(bases.box5, 94000);
  assert.equal(bases.localWages, 94000);
  assert.notEqual(bases.box5, bases.box1);

  const estimate = estimateHouseholdTax({
    year: 2026,
    profile: { ...OWNER, filing_status: "single", state_code: "OH", children_under_17: 0 },
    gross: 200000,
    deductions: {},
    withheld: { social_security: roundMoney(184500 * 0.062) + 50, medicare: 0 },
  });
  assert.equal(estimate.wages.box3, 184500);
  assert.equal(estimate.wages.box5, 200000);
  assert.equal(estimate.fica.socialSecurityRate, 0.062);
  assert.equal(estimate.fica.medicareRate, 0.0145);
  assert.equal(estimate.fica.expectedSocialSecurity, roundMoney(184500 * 0.062));
  assert.equal(estimate.fica.expectedMedicareBase, roundMoney(200000 * 0.0145));
  assert.equal(estimate.fica.socialSecurityOver, true);

  const joint = estimateHouseholdTax({
    year: 2026,
    profile: { ...OWNER, children_under_17: 0 },
    gross: 260000,
    deductions: {},
    withheld: {},
  });
  assert.equal(joint.fica.expectedAdditionalMedicare, 90);
  const single = estimateHouseholdTax({
    year: 2026,
    profile: { filing_status: "single", state_code: "OH" },
    gross: 260000,
    deductions: {},
    withheld: {},
  });
  assert.equal(single.fica.expectedAdditionalMedicare, 540);
});

test("a no-tax state is zero and a flat state uses its published rate", () => {
  const { rules } = getStateRules(2026);
  assert.ok(rules.noIncomeTax.includes("FL"));
  const florida = estimateHouseholdTax({
    year: 2026,
    profile: { filing_status: "single", state_code: "FL" },
    gross: 50000,
    withheld: { state: 25 },
  });
  assert.equal(florida.state.kind, "none");
  assert.equal(florida.state.estimatedTax, 0);
  assert.equal(florida.state.balance, -25);
  assert.match(florida.state.message, /no tax/i);

  const pennsylvania = rules.flat.find((state) => state.code === "PA");
  assert.equal(pennsylvania.rate, 0.0307);
  const pa = estimateHouseholdTax({
    year: 2026,
    profile: { filing_status: "single", state_code: "PA" },
    gross: 10000,
  });
  assert.equal(pa.state.kind, "flat");
  assert.equal(pa.state.estimatedTax, roundMoney(10000 * pennsylvania.rate));
  assert.equal(pa.wages.localWages, pa.wages.box1);

  const california = estimateHouseholdTax({
    year: 2026,
    profile: { filing_status: "single", state_code: "CA" },
    gross: 10000,
  });
  assert.equal(california.state.available, false);
  assert.equal(california.state.estimatedTax, null);
  assert.equal(california.state.balance, null);
  assert.match(california.state.message, /State estimate not yet available/);
});

test("a missing profile does not assume Single and a missing table keeps withholding", () => {
  const missing = buildTaxPageModel({
    year: 2026,
    profile: null,
    gross: GROSS,
    deductions: DEDUCTIONS,
    withholding: WITHHELD,
    net: 32000,
  });
  assert.equal(missing.profileMissing, true);
  assert.equal(missing.ytd.federal, null);
  assert.equal(missing.ytd.state, null);
  assert.equal(missing.withholding.federal, WITHHELD.federal);
  assert.equal(missing.withholding.social_security, WITHHELD.social_security);
  assert.equal(missing.incomeRows.find((row) => row.key === "net").amount, 32000);
  assert.equal(missing.incomeRows.find((row) => row.key === "taxable").amount, 43944);
  assert.equal(missing.comparison.length, 0);

  const unavailable = buildTaxPageModel({
    year: 2026,
    profile: null,
    profileUnavailable: true,
    gross: GROSS,
    withholding: WITHHELD,
  });
  assert.equal(unavailable.profileUnavailable, true);
  assert.equal(unavailable.profileMissing, false);
  assert.equal(unavailable.ytd.federal, null);
  assert.equal(unavailable.withholding.federal, WITHHELD.federal);
  assert.equal(unavailable.withholding.state, WITHHELD.state);
  assert.equal(unavailable.withholding.local, WITHHELD.local);

  assert.equal(isMissingRelationError({ code: "42P01" }, "tax_household_profiles"), true);
  assert.equal(
    isMissingRelationError({ message: 'relation "tax_household_profiles" does not exist' }, "tax_household_profiles"),
    true,
  );
  assert.equal(isMissingRelationError({ message: "connection refused" }, "tax_household_profiles"), false);
});

test("deduction types declare wage bases and net pay stays out of gross", () => {
  const types = deductionTypes();
  for (const type of types.filter((row) => row.class === "section125")) {
    assert.equal(type.reduces.federalIncome, true);
    assert.equal(type.reduces.socialSecurity, true);
    assert.equal(type.reduces.medicare, true);
    assert.equal(type.reduces.local, "jurisdiction");
  }
  for (const type of types.filter((row) => row.class === "retirement_pretax")) {
    assert.equal(type.reduces.federalIncome, true);
    assert.equal(type.reduces.socialSecurity, false);
    assert.equal(type.reduces.local, false);
  }
  for (const type of types.filter((row) => row.class === "posttax")) {
    assert.equal(type.reduces.federalIncome, false);
    assert.equal(type.reduces.socialSecurity, false);
    assert.equal(type.reduces.medicare, false);
    assert.equal(type.reduces.local, false);
  }

  assert.equal(classifyFiscalIncomeKind("Payroll", "Net Pay"), "net");
  assert.equal(classifyFiscalIncomeKind("Payroll", "Gross Pay"), "gross");
  assert.equal(classifyFiscalPretaxKind("Benefits", "401(k)"), "401k");
  assert.equal(classifyFiscalPosttaxKind("Benefits", "Roth 401k"), "roth_401k");
  assert.equal(classifyFiscalPretaxKind("Benefits", "Roth 401k"), null);
  assert.equal(classifyFiscalPretaxKind("Benefits", "Dental"), "dental");
  assert.equal(classifyFiscalPosttaxKind("Benefits", "Supplemental Life"), "supplemental_life");
  assert.equal(
    classifyDeductionType("Misc", "Payroll", [{ category: "Misc", subCategory: "Payroll", deductionKey: "hsa" }])?.key,
    "hsa",
  );

  const roth = wageBases({ gross: 1000, deductions: { roth_401k: 100, "401k": 200 }, stateCode: "OH" });
  assert.equal(roth.box1, 800);
  assert.equal(roth.box5, 1000);
});

test("full-year view annualizes paychecks and falls back to the budget plan", () => {
  const annualized = projectFullYear({
    gross: 10000,
    deductions: { "401k": 1000 },
    withheld: { federal: 800 },
    paychecksSoFar: 10,
    paychecksPerYear: 20,
  });
  assert.equal(annualized.method, "paychecks");
  assert.equal(annualized.gross, 20000);
  assert.equal(annualized.deductions["401k"], 2000);
  assert.equal(annualized.withheld.federal, 1600);

  const plan = summarizeBudgetPlan([
    { itemKind: "income", itemType: "gross", category: "Gross Pay", annualAmount: 80000 },
    { itemKind: "income", itemType: "gross", category: "Payroll", subCategory: "Net Pay", annualAmount: 50000 },
    { itemKind: "income", itemType: "deduction", category: "401(k)", annualAmount: 4000 },
    { itemKind: "income", itemType: "tax", category: "Federal", annualAmount: 6000 },
  ]);
  assert.equal(plan.gross, 80000);
  assert.equal(plan.net, 50000);
  assert.equal(plan.deductions["401k"], 4000);
  assert.equal(plan.withholding.federal, 6000);
  const fromBudget = projectFullYear({ gross: 10000, paychecksSoFar: 0, budgetPlan: plan });
  assert.equal(fromBudget.method, "budget");
  assert.equal(fromBudget.gross, 80000);

  const page = buildTaxPageModel({
    year: 2026,
    profile: { ...OWNER, paychecks_per_year: 26 },
    gross: GROSS,
    net: 30000,
    deductions: DEDUCTIONS,
    withholding: WITHHELD,
    paychecksSoFar: 13,
  });
  assert.equal(page.projected.method, "paychecks");
  assert.equal(page.projected.estimate.wages.gross, 100000);
  assert.ok(page.preTaxRows.some((row) => row.label === "401K"));
  assert.ok(page.postTaxRows.some((row) => row.label === "Supplemental Life"));
  assert.ok(page.wageFigure.some((row) => row.key === "box1" && row.amount === 43944));
  assert.ok(page.wageFigure.some((row) => String(row.label).includes("Section 125")));
  assert.equal(page.comparison[0].ytdBalance, page.ytd.federal.balance);
  assert.notEqual(page.comparison[0].projectedBalance, page.comparison[0].ytdBalance);
});

test("the tax page keeps the old sections and the estimate disclaimer", () => {
  const page = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../pages/tax/[year].vue"), "utf8");
  assert.match(page, /Pre-Tax/);
  assert.match(page, /Post-Tax/);
  assert.match(page, /Taxable Income|row.label/);
  assert.match(page, /How taxable wages were figured/);
  assert.match(page, /Set up your tax profile/);
  assert.match(page, /border-primary/);
  assert.match(page, /app-page-wide/);
  assert.equal(TAX_ESTIMATE_DISCLAIMER, "This is an estimate, not tax advice or a filing.");
  assert.match(page, /TAX_ESTIMATE_DISCLAIMER|This is an estimate, not tax advice or a filing/);
  const federal = getFederalRules(2026);
  assert.equal(federal.rules.standardDeduction.married_filing_jointly, 32200);
  assert.equal(federal.rules.selfEmployment.socialSecurityWageBase, 184500);
});
