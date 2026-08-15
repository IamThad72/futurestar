import { roundMoney } from "./federalTaxEstimate.js";

/** Ohio IT-1040 for 2026 (ORC 5747.02 / HB 96). Later years fall back to these until updated. */

export const OHIO_TAX_SCENARIO = {
  filingStatus: "married_filing_jointly",
  filingStatusLabel: "Married filing jointly",
  stateLabel: "Ohio",
  dependents: 1,
  exemptionCount: 3,
};

const PARAMS_BY_YEAR = {
  2026: {
    zeroTaxMax: 26050,
    baseTaxOverZero: 332,
    rate: 0.0275,
    exemptionMagiCap: 500000,
    exemptionTiers: [
      { maxMagi: 40000, amount: 2350 },
      { maxMagi: 80000, amount: 2100 },
      { maxMagi: Number.POSITIVE_INFINITY, amount: 1850 },
    ],
    personalExemptionCreditPer: 20,
    personalExemptionCreditIncomeMax: 30000,
    jointFilingCreditMax: 650,
    jointFilingCreditMagiCap: 500000,
    jointFilingCreditTiers: [
      { maxIncome: 25000, rate: 0.2 },
      { maxIncome: 50000, rate: 0.15 },
      { maxIncome: 75000, rate: 0.1 },
      { maxIncome: Number.POSITIVE_INFINITY, rate: 0.05 },
    ],
  },
};

const DEFAULT_PARAMS_YEAR = 2026;

export function getOhioTaxParams(year) {
  const y = Number(year);
  if (Number.isFinite(y) && PARAMS_BY_YEAR[y]) {
    return { year: y, paramsYear: y, ...PARAMS_BY_YEAR[y] };
  }
  return { year: y, paramsYear: DEFAULT_PARAMS_YEAR, ...PARAMS_BY_YEAR[DEFAULT_PARAMS_YEAR] };
}

export function ohioPersonalExemptionPerPerson(magi, params) {
  const income = roundMoney(Math.max(0, magi));
  if (income >= params.exemptionMagiCap) return 0;
  for (const tier of params.exemptionTiers) {
    if (income <= tier.maxMagi) return tier.amount;
  }
  return 0;
}

export function ohioTaxBeforeCredits(taxableIncome, params) {
  const taxable = roundMoney(Math.max(0, taxableIncome));
  if (taxable <= params.zeroTaxMax) return 0;
  return roundMoney(params.baseTaxOverZero + params.rate * (taxable - params.zeroTaxMax));
}

export function ohioJointFilingCreditRate(incomeLessExemptions, params) {
  const income = roundMoney(Math.max(0, incomeLessExemptions));
  for (const tier of params.jointFilingCreditTiers) {
    if (income <= tier.maxIncome) return tier.rate;
  }
  return 0;
}

/**
 * Ohio income tax estimate: MFJ resident, personal exemptions for taxpayer + spouse + 1 dependent.
 * Assumes both spouses have at least $500 of qualifying earned income (joint filing credit).
 * `incomeAfterPretax` is the page Taxable Income total (gross − pre-tax), used as Ohio AGI.
 */
export function estimateOhioTaxMfjOneDependent({
  incomeAfterPretax = 0,
  stateWithheld = 0,
  year = DEFAULT_PARAMS_YEAR,
} = {}) {
  const params = getOhioTaxParams(year);
  const ohioAgi = roundMoney(Math.max(0, incomeAfterPretax));
  const exemptionPerPerson = ohioPersonalExemptionPerPerson(ohioAgi, params);
  const personalExemptions = roundMoney(exemptionPerPerson * OHIO_TAX_SCENARIO.exemptionCount);
  const taxableIncome = roundMoney(Math.max(0, ohioAgi - personalExemptions));
  const taxBeforeCredits = ohioTaxBeforeCredits(taxableIncome, params);

  const personalExemptionCreditMax =
    taxableIncome < params.personalExemptionCreditIncomeMax && exemptionPerPerson > 0
      ? roundMoney(params.personalExemptionCreditPer * OHIO_TAX_SCENARIO.exemptionCount)
      : 0;
  const personalExemptionCredit = roundMoney(Math.min(personalExemptionCreditMax, taxBeforeCredits));
  const afterExemptionCredit = roundMoney(Math.max(0, taxBeforeCredits - personalExemptionCredit));

  const jointFilingEligible = ohioAgi < params.jointFilingCreditMagiCap && exemptionPerPerson > 0;
  const jointFilingCreditRate = jointFilingEligible
    ? ohioJointFilingCreditRate(taxableIncome, params)
    : 0;
  const jointFilingCredit = jointFilingEligible
    ? roundMoney(
        Math.min(params.jointFilingCreditMax, afterExemptionCredit * jointFilingCreditRate),
      )
    : 0;

  const estimatedOhioTax = roundMoney(Math.max(0, afterExemptionCredit - jointFilingCredit));
  const withheld = roundMoney(Math.max(0, stateWithheld));
  const balance = roundMoney(estimatedOhioTax - withheld);

  return {
    filingStatus: OHIO_TAX_SCENARIO.filingStatus,
    filingStatusLabel: OHIO_TAX_SCENARIO.filingStatusLabel,
    stateLabel: OHIO_TAX_SCENARIO.stateLabel,
    dependents: OHIO_TAX_SCENARIO.dependents,
    exemptionCount: OHIO_TAX_SCENARIO.exemptionCount,
    year: params.year,
    paramsYear: params.paramsYear,
    incomeAfterPretax: ohioAgi,
    exemptionPerPerson,
    personalExemptions,
    taxableIncome,
    taxBeforeCredits,
    personalExemptionCredit,
    jointFilingCredit,
    jointFilingCreditRate,
    estimatedOhioTax,
    stateWithheld: withheld,
    balance,
  };
}
