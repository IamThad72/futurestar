/** 2026 IRS figures (Rev. Proc. 2025-32 / OBBB). Later years fall back to these until updated. */

export const FEDERAL_TAX_SCENARIO = {
  filingStatus: "married_filing_jointly",
  filingStatusLabel: "Married filing jointly",
  qualifyingChildren: 1,
};

const PARAMS_BY_YEAR = {
  2026: {
    standardDeduction: 32200,
    brackets: [
      { max: 24800, rate: 0.1 },
      { max: 100800, rate: 0.12 },
      { max: 211400, rate: 0.22 },
      { max: 403550, rate: 0.24 },
      { max: 512450, rate: 0.32 },
      { max: 768700, rate: 0.35 },
      { max: null, rate: 0.37 },
    ],
    childTaxCreditPerChild: 2200,
    additionalChildTaxCreditPerChild: 1700,
    childTaxCreditPhaseoutStart: 400000,
    childTaxCreditPhaseoutStep: 1000,
    childTaxCreditPhaseoutAmount: 50,
    actcEarnedIncomeFloor: 2500,
    actcEarnedIncomeRate: 0.15,
  },
};

const DEFAULT_PARAMS_YEAR = 2026;

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function getFederalTaxParams(year) {
  const y = Number(year);
  if (Number.isFinite(y) && PARAMS_BY_YEAR[y]) {
    return { year: y, paramsYear: y, ...PARAMS_BY_YEAR[y] };
  }
  return { year: y, paramsYear: DEFAULT_PARAMS_YEAR, ...PARAMS_BY_YEAR[DEFAULT_PARAMS_YEAR] };
}

export function taxFromBrackets(taxableIncome, brackets) {
  let remaining = Math.max(0, roundMoney(taxableIncome));
  let tax = 0;
  let prev = 0;
  for (const { max, rate } of brackets) {
    const cap = max == null ? Number.POSITIVE_INFINITY : max;
    const slice = Math.min(remaining, cap - prev);
    if (slice <= 0) break;
    tax += slice * rate;
    remaining -= slice;
    prev = cap;
    if (remaining <= 0) break;
  }
  return roundMoney(tax);
}

export function childTaxCreditAmount(agi, children, params) {
  const count = Math.max(0, Math.floor(Number(children) || 0));
  if (count <= 0) return 0;
  const maxCredit = roundMoney(count * params.childTaxCreditPerChild);
  const excess = roundMoney(agi) - params.childTaxCreditPhaseoutStart;
  if (excess <= 0) return maxCredit;
  const steps = Math.ceil(excess / params.childTaxCreditPhaseoutStep);
  return roundMoney(Math.max(0, maxCredit - steps * params.childTaxCreditPhaseoutAmount));
}

/**
 * Federal income tax estimate: MFJ, standard deduction, 1 qualifying child.
 * `incomeAfterPretax` is the page Taxable Income total (gross − pre-tax).
 */
export function estimateFederalTaxMfjStandardOneChild({
  incomeAfterPretax = 0,
  federalWithheld = 0,
  year = DEFAULT_PARAMS_YEAR,
} = {}) {
  const params = getFederalTaxParams(year);
  const agi = roundMoney(Math.max(0, incomeAfterPretax));
  const standardDeduction = params.standardDeduction;
  const taxableIncome = roundMoney(Math.max(0, agi - standardDeduction));
  const taxBeforeCredits = taxFromBrackets(taxableIncome, params.brackets);

  const maxCtc = childTaxCreditAmount(agi, FEDERAL_TAX_SCENARIO.qualifyingChildren, params);
  const nonrefundableCtc = roundMoney(Math.min(maxCtc, taxBeforeCredits));
  const unusedCtc = roundMoney(Math.max(0, maxCtc - nonrefundableCtc));
  const refundableCap = roundMoney(
    FEDERAL_TAX_SCENARIO.qualifyingChildren * params.additionalChildTaxCreditPerChild,
  );
  const earnedIncomeLimit = roundMoney(
    Math.max(0, agi - params.actcEarnedIncomeFloor) * params.actcEarnedIncomeRate,
  );
  const refundableChildTaxCredit = roundMoney(
    Math.min(unusedCtc, refundableCap, earnedIncomeLimit),
  );

  const estimatedFederalTax = roundMoney(taxBeforeCredits - nonrefundableCtc);
  const withheld = roundMoney(Math.max(0, federalWithheld));
  const netAfterCredits = roundMoney(estimatedFederalTax - refundableChildTaxCredit);
  const balance = roundMoney(netAfterCredits - withheld);

  return {
    filingStatus: FEDERAL_TAX_SCENARIO.filingStatus,
    filingStatusLabel: FEDERAL_TAX_SCENARIO.filingStatusLabel,
    qualifyingChildren: FEDERAL_TAX_SCENARIO.qualifyingChildren,
    year: params.year,
    paramsYear: params.paramsYear,
    incomeAfterPretax: agi,
    standardDeduction,
    taxableIncome,
    taxBeforeCredits,
    childTaxCredit: nonrefundableCtc,
    childTaxCreditMax: maxCtc,
    refundableChildTaxCredit,
    estimatedFederalTax,
    federalWithheld: withheld,
    netAfterCredits,
    balance,
  };
}
