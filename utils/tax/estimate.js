import { summarizeBudgetIncome } from "./budgetIncome.js";
import { marginalBracketRate, nonNegativeMoney, roundMoney, taxFromBrackets } from "./money.js";
import { dependentCount, FILING_STATUS_LABELS, normalizeTaxProfile, stateName } from "./profile.js";
import { getFederalRules, getStateRules } from "./rules.js";

function amountFor(table, filingStatus) {
  if (!table) return 0;
  if (filingStatus === "head_of_household") return nonNegativeMoney(table.head ?? table.single);
  if (filingStatus === "married_filing_separately") return nonNegativeMoney(table.separate ?? table.single);
  if (filingStatus === "married_filing_jointly" || filingStatus === "qualifying_surviving_spouse") {
    return nonNegativeMoney(table.couple ?? table.single);
  }
  return nonNegativeMoney(table.single);
}

function filingLabel(status) {
  return FILING_STATUS_LABELS[status] || "Single";
}

function rateLabel(rate) {
  const pct = roundMoney(rate * 100);
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

export function estimateSelfEmploymentTax(profile, rules) {
  const se = rules.selfEmployment;
  const profit = nonNegativeMoney(profile.selfEmployment);
  const wages = nonNegativeMoney(profile.wages);
  if (profit <= 0) {
    return {
      netProfit: 0,
      netEarnings: 0,
      socialSecurityTax: 0,
      medicareTax: 0,
      additionalMedicareTax: 0,
      deductibleHalf: 0,
      total: 0,
    };
  }
  const netEarnings = roundMoney(profit * se.netEarningsFactor);
  if (netEarnings < se.minimumNetEarnings) {
    return {
      netProfit: profit,
      netEarnings,
      socialSecurityTax: 0,
      medicareTax: 0,
      additionalMedicareTax: 0,
      deductibleHalf: 0,
      total: 0,
    };
  }
  const socialSecurityBase = roundMoney(Math.max(0, se.socialSecurityWageBase - wages));
  const socialSecurityEarnings = roundMoney(Math.min(netEarnings, socialSecurityBase));
  const socialSecurityTax = roundMoney(socialSecurityEarnings * se.socialSecurityRate);
  const medicareTax = roundMoney(netEarnings * se.medicareRate);
  const threshold = se.additionalMedicareThreshold[profile.filingStatus] ?? se.additionalMedicareThreshold.single;
  const wageRoom = Math.max(0, threshold - wages);
  const additionalBase = roundMoney(Math.max(0, netEarnings - wageRoom));
  const additionalMedicareTax = roundMoney(additionalBase * se.additionalMedicareRate);
  const deductibleHalf = roundMoney((socialSecurityTax + medicareTax) / 2);
  const total = roundMoney(socialSecurityTax + medicareTax + additionalMedicareTax);
  return {
    netProfit: profit,
    netEarnings,
    socialSecurityTax,
    medicareTax,
    additionalMedicareTax,
    deductibleHalf,
    total,
  };
}

function estimateCredits(profile, rules, agi, taxBeforeCredits, earnedIncome) {
  const ctc = rules.childTaxCredit;
  const children = profile.childrenUnder17;
  const others = profile.otherDependents;
  const childTaxCreditMax = roundMoney(children * ctc.perChild);
  const otherDependentCreditMax = roundMoney(others * ctc.otherDependent);
  const creditBeforePhaseout = roundMoney(childTaxCreditMax + otherDependentCreditMax);
  const threshold = ctc.phaseout[profile.filingStatus] ?? ctc.phaseout.single;
  const excess = roundMoney(agi - threshold);
  const phaseoutReduction =
    excess > 0 ? roundMoney(Math.ceil(excess / ctc.phaseoutStep) * ctc.phaseoutAmount) : 0;
  const creditAfterPhaseout = roundMoney(Math.max(0, creditBeforePhaseout - phaseoutReduction));
  // The phaseout applies to the combined credit. Qualifying-child credit is kept first
  // so the refundable additional child tax credit still has a base when other dependents absorbed the reduction.
  const childCreditAfterPhaseout = roundMoney(Math.min(childTaxCreditMax, creditAfterPhaseout));
  const otherCreditAfterPhaseout = roundMoney(creditAfterPhaseout - childCreditAfterPhaseout);
  const nonrefundable = roundMoney(Math.min(creditAfterPhaseout, Math.max(0, taxBeforeCredits)));
  const childCreditUsed = roundMoney(Math.min(childCreditAfterPhaseout, nonrefundable));
  const unusedChildCredit = roundMoney(Math.max(0, childCreditAfterPhaseout - childCreditUsed));
  const refundableCap = roundMoney(children * ctc.refundablePerChild);
  const earnedLimit = roundMoney(Math.max(0, earnedIncome - ctc.earnedIncomeFloor) * ctc.earnedIncomeRate);
  const refundable = roundMoney(Math.min(unusedChildCredit, refundableCap, earnedLimit));
  return {
    childTaxCreditMax,
    otherDependentCreditMax,
    creditBeforePhaseout,
    phaseoutThreshold: threshold,
    phaseoutReduction,
    creditAfterPhaseout,
    childCreditAfterPhaseout,
    otherCreditAfterPhaseout,
    nonrefundable,
    refundable,
  };
}

export function estimateFederalTax(profileInput, year) {
  const profile = normalizeTaxProfile(profileInput);
  const { rulesYear, rules } = getFederalRules(year);
  const selfEmployment = estimateSelfEmploymentTax(profile, rules);
  const wages = nonNegativeMoney(profile.wages);
  const selfEmploymentIncome = nonNegativeMoney(profile.selfEmployment);
  const retirement = nonNegativeMoney(profile.retirement);
  const otherIncome = nonNegativeMoney(profile.otherIncome);
  const grossIncome = roundMoney(wages + selfEmploymentIncome + retirement + otherIncome);
  const agi = roundMoney(Math.max(0, grossIncome - selfEmployment.deductibleHalf));
  const standardDeduction = rules.standardDeduction[profile.filingStatus] ?? rules.standardDeduction.single;
  const deduction =
    profile.deductionMethod === "itemized"
      ? nonNegativeMoney(profile.itemizedDeduction)
      : standardDeduction;
  const taxableIncome = roundMoney(Math.max(0, agi - deduction));
  const brackets = rules.brackets[profile.filingStatus] || rules.brackets.single;
  const bracketTax = taxFromBrackets(taxableIncome, brackets);
  const earnedIncome = roundMoney(Math.max(0, wages + selfEmploymentIncome));
  const credits = estimateCredits(profile, rules, agi, bracketTax.tax, earnedIncome);
  const incomeTax = roundMoney(Math.max(0, bracketTax.tax - credits.nonrefundable));
  const totalTax = roundMoney(incomeTax + selfEmployment.total - credits.refundable);
  const ordinaryMarginal =
    taxableIncome === 0 && agi < deduction ? 0 : marginalBracketRate(taxableIncome, brackets);
  const effectiveRate = grossIncome > 0 ? roundMoney((totalTax / grossIncome) * 10000) / 10000 : 0;
  return {
    year: Number(year) || rulesYear,
    rulesYear,
    filingStatus: profile.filingStatus,
    filingStatusLabel: filingLabel(profile.filingStatus),
    grossIncome,
    wages,
    selfEmploymentIncome,
    retirement,
    otherIncome,
    agi,
    deductionMethod: profile.deductionMethod,
    standardDeduction,
    deduction,
    taxableIncome,
    brackets: bracketTax.slices,
    taxBeforeCredits: bracketTax.tax,
    credits,
    incomeTax,
    selfEmployment,
    totalTax,
    effectiveRate,
    marginalRate: ordinaryMarginal,
    usingPriorYearRules: rulesYear !== Number(year),
  };
}

function ohioExemptionPerPerson(magi, ohio) {
  const income = nonNegativeMoney(magi);
  if (income >= ohio.exemptionMagiCap) return 0;
  for (const tier of ohio.exemptionTiers) {
    if (tier.maxMagi == null || income <= tier.maxMagi) return tier.amount;
  }
  return 0;
}

function ohioBracketTax(taxableIncome, brackets) {
  const income = nonNegativeMoney(taxableIncome);
  for (const bracket of brackets) {
    const cap = bracket.upTo == null ? Number.POSITIVE_INFINITY : bracket.upTo;
    if (income <= cap || bracket.upTo == null) {
      if (!bracket.rate || income <= (bracket.threshold || 0)) return 0;
      return roundMoney(bracket.base + bracket.rate * (income - bracket.threshold));
    }
  }
  return 0;
}

function ohioJointRate(incomeLessExemptions, tiers) {
  const income = nonNegativeMoney(incomeLessExemptions);
  for (const tier of tiers) {
    if (tier.maxIncome == null || income <= tier.maxIncome) return tier.rate;
  }
  return 0;
}

function estimateOhioTax(profile, agi, ohio) {
  const exemptionCount =
    (profile.filingStatus === "married_filing_jointly" ? 2 : 1) + dependentCount(profile);
  const exemptionPerPerson = ohioExemptionPerPerson(agi, ohio);
  const personalExemptions = roundMoney(exemptionPerPerson * exemptionCount);
  const taxableIncome = roundMoney(Math.max(0, agi - personalExemptions));
  const taxBeforeCredits = ohioBracketTax(taxableIncome, ohio.brackets);
  const personalExemptionCreditMax =
    taxableIncome < ohio.personalExemptionCreditIncomeMax && exemptionPerPerson > 0
      ? roundMoney(ohio.personalExemptionCreditPer * exemptionCount)
      : 0;
  const personalExemptionCredit = roundMoney(Math.min(personalExemptionCreditMax, taxBeforeCredits));
  const afterExemptionCredit = roundMoney(Math.max(0, taxBeforeCredits - personalExemptionCredit));
  const jointEligible =
    profile.filingStatus === "married_filing_jointly" &&
    agi < ohio.jointFilingCreditMagiCap &&
    exemptionPerPerson > 0;
  const jointFilingCreditRate = jointEligible ? ohioJointRate(taxableIncome, ohio.jointFilingCreditTiers) : 0;
  const jointFilingCredit = jointEligible
    ? roundMoney(Math.min(ohio.jointFilingCreditMax, afterExemptionCredit * jointFilingCreditRate))
    : 0;
  const tax = roundMoney(Math.max(0, afterExemptionCredit - jointFilingCredit));
  return {
    exemptionCount,
    exemptionPerPerson,
    personalExemptions,
    taxableIncome,
    taxBeforeCredits,
    personalExemptionCredit,
    jointFilingCredit,
    jointFilingCreditRate,
    tax,
    note: ohio.note,
  };
}

function estimateFlatTax(profile, agi, state) {
  const dependents = dependentCount(profile);
  const standardDeduction = amountFor(state.standardDeduction, profile.filingStatus);
  const personalExemption = amountFor(state.personalExemption, profile.filingStatus);
  const dependentExemption = roundMoney((Number(state.dependentExemption) || 0) * dependents);
  const zeroRateBand = amountFor(state.zeroRateBand, profile.filingStatus);
  const taxableIncome = roundMoney(
    Math.max(0, agi - standardDeduction - personalExemption - dependentExemption - zeroRateBand),
  );
  const taxBeforeCredits = roundMoney(taxableIncome * state.rate);
  const credit = roundMoney(
    amountFor(state.personalCredit, profile.filingStatus) + (Number(state.dependentCredit) || 0) * dependents,
  );
  const tax = roundMoney(Math.max(0, taxBeforeCredits - credit));
  return {
    rate: state.rate,
    standardDeduction,
    personalExemption,
    dependentExemption,
    zeroRateBand,
    taxableIncome,
    taxBeforeCredits,
    credit,
    tax,
    note: state.note || "",
  };
}

export function estimateStateTax(profileInput, year, agi) {
  const profile = normalizeTaxProfile(profileInput);
  const { rulesYear, rules } = getStateRules(year);
  const code = profile.stateCode;
  const base = {
    year: Number(year) || rulesYear,
    rulesYear,
    code,
    name: stateName(code),
    usingPriorYearRules: rulesYear !== Number(year),
  };
  if (!code) {
    return {
      ...base,
      available: false,
      kind: "missing",
      message: "Add a state in your tax profile to estimate state income tax.",
      taxableIncome: 0,
      tax: 0,
      detail: null,
    };
  }
  if (rules.noIncomeTax.includes(code)) {
    const name = stateName(code);
    const washington =
      code === "WA" ? " Washington's capital-gains tax is not part of this estimate." : "";
    return {
      ...base,
      available: true,
      kind: "none",
      message: `${name} has no tax on wages and ordinary income.${washington}`,
      taxableIncome: roundMoney(Math.max(0, agi)),
      tax: 0,
      detail: null,
    };
  }
  if (code === "OH" && rules.ohio) {
    const detail = estimateOhioTax(profile, agi, rules.ohio);
    return {
      ...base,
      available: true,
      kind: "ohio",
      message: "",
      taxableIncome: detail.taxableIncome,
      tax: detail.tax,
      detail,
    };
  }
  const flat = (rules.flat || []).find((row) => row.code === code);
  if (flat) {
    const detail = estimateFlatTax(profile, agi, flat);
    return {
      ...base,
      name: flat.name,
      available: true,
      kind: "flat",
      message: "",
      taxableIncome: detail.taxableIncome,
      tax: detail.tax,
      detail,
    };
  }
  const name = stateName(code) || code;
  return {
    ...base,
    available: false,
    kind: "unavailable",
    message: `State estimate not yet available for ${name}.`,
    taxableIncome: 0,
    tax: 0,
    detail: null,
  };
}

export function estimateLocalTax(profileInput) {
  const profile = normalizeTaxProfile(profileInput);
  const rate = profile.localRate;
  const base = roundMoney(nonNegativeMoney(profile.wages) + nonNegativeMoney(profile.selfEmployment));
  const tax = roundMoney(base * rate);
  const labelParts = [profile.localJurisdiction, profile.localZip].filter(Boolean);
  return {
    jurisdiction: profile.localJurisdiction,
    zip: profile.localZip,
    label: labelParts.join(" · "),
    rate,
    base,
    tax,
    message:
      rate > 0
        ? ""
        : "Enter a local rate to estimate a city or school district tax. Nothing is assumed.",
  };
}

function asBudgetTotals(value) {
  if (!value) return null;
  if (Array.isArray(value)) return summarizeBudgetIncome(value);
  if (Array.isArray(value.lines)) return summarizeBudgetIncome(value.lines);
  return {
    wages: Number(value.wages) || 0,
    self_employment: Number(value.self_employment ?? value.selfEmployment) || 0,
    retirement: Number(value.retirement) || 0,
    other_income: Number(value.other_income ?? value.otherIncome) || 0,
  };
}

function withheldAmount(withheld, key) {
  if (!withheld) return 0;
  const value = withheld[key];
  return nonNegativeMoney(value);
}

/**
 * Full estimate. `profile` income is used as given.
 * Pass `budgetIncome` only when the caller wants this function to substitute budget totals
 * (the tax page usually resolves that before calling).
 */
export function estimateTax({
  year,
  profile: profileInput = {},
  withheld = {},
  budgetIncome = null,
  useBudgetIncome = null,
} = {}) {
  const useBudget =
    useBudgetIncome != null
      ? Boolean(useBudgetIncome)
      : Boolean(profileInput.useBudgetIncome ?? profileInput.use_budget_income);
  const budget = asBudgetTotals(budgetIncome);
  const incomeSource = useBudget && budget ? budget : null;
  const merged = incomeSource
    ? {
        ...profileInput,
        wages: incomeSource.wages,
        selfEmployment: incomeSource.self_employment ?? incomeSource.selfEmployment,
        self_employment: incomeSource.self_employment ?? incomeSource.selfEmployment,
        retirement: incomeSource.retirement,
        otherIncome: incomeSource.other_income ?? incomeSource.otherIncome,
        other_income: incomeSource.other_income ?? incomeSource.otherIncome,
      }
    : profileInput;
  const profile = normalizeTaxProfile(merged);
  const federal = estimateFederalTax(profile, year);
  const state = estimateStateTax(profile, year, federal.agi);
  const local = estimateLocalTax(profile);
  const federalWithheld = withheldAmount(withheld, "federal");
  const stateWithheld = withheldAmount(withheld, "state");
  const localWithheld = withheldAmount(withheld, "local");
  const federalBalance = roundMoney(federal.totalTax - federalWithheld);
  const stateBalance = roundMoney(state.tax - stateWithheld);
  const localBalance = roundMoney(local.tax - localWithheld);
  const totalTax = roundMoney(federal.totalTax + (state.available ? state.tax : 0) + local.tax);
  const gross = federal.grossIncome;
  return {
    year: federal.year,
    rulesYear: federal.rulesYear,
    profile,
    incomeSource: useBudget && budget ? "budget" : "profile",
    federal: { ...federal, withheld: federalWithheld, balance: federalBalance },
    state: { ...state, withheld: stateWithheld, balance: stateBalance },
    local: { ...local, withheld: localWithheld, balance: localBalance },
    totalTax,
    effectiveRate: gross > 0 ? roundMoney((totalTax / gross) * 10000) / 10000 : 0,
    marginalRate: federal.marginalRate,
  };
}

export function percentLabel(rate) {
  return rateLabel(rate);
}

export { normalizeTaxProfile, FILING_STATUS_LABELS, FILING_STATUSES, US_STATES, stateName } from "./profile.js";
export { summarizeBudgetIncome, emptyBudgetIncome, budgetIncomeTotal } from "./budgetIncome.js";
export { roundMoney } from "./money.js";
