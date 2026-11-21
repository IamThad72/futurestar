import { wageBases, wageFigureLines } from "./deductions.js";
import { nonNegativeMoney, roundMoney, taxFromBrackets } from "./money.js";
import {
  dependentCount,
  normalizeTaxProfile,
  normalizeWithholding,
  ohioExemptionCount,
  stateName,
} from "./profile.js";
import { getFederalRules, getStateRules } from "./rules.js";

const FICA_OVER_TOLERANCE = 1;

function amountFor(table, filingStatus) {
  if (!table) return 0;
  if (filingStatus === "head_of_household") return nonNegativeMoney(table.head ?? table.single);
  if (filingStatus === "married_filing_separately") return nonNegativeMoney(table.separate ?? table.single);
  if (filingStatus === "married_filing_jointly" || filingStatus === "qualifying_surviving_spouse") {
    return nonNegativeMoney(table.couple ?? table.single);
  }
  return nonNegativeMoney(table.single);
}

function balanceFields(balance) {
  if (balance == null || !Number.isFinite(balance)) {
    return { balance: null, balanceLabel: null };
  }
  return {
    balance,
    balanceLabel: balance > 0 ? "Owed" : balance < 0 ? "Refund" : "Settled",
  };
}

function balanceRow(balance) {
  if (balance == null || !Number.isFinite(balance)) return null;
  return {
    key: "balance",
    label: balance >= 0 ? "Estimated amount owed" : "Estimated refund",
    amount: Math.abs(balance),
    emphasis: true,
    amountClass: balance > 0 ? "text-warning" : balance < 0 ? "text-success" : "text-base-content",
  };
}

function percentText(rate) {
  const pct = rate * 100;
  const rounded = Math.round(pct * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
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
  const childCreditAfterPhaseout = roundMoney(Math.min(childTaxCreditMax, creditAfterPhaseout));
  const otherCreditAfterPhaseout = roundMoney(creditAfterPhaseout - childCreditAfterPhaseout);
  const nonrefundablePool = roundMoney(Math.min(creditAfterPhaseout, Math.max(0, taxBeforeCredits)));
  const childCreditUsed = roundMoney(Math.min(childCreditAfterPhaseout, nonrefundablePool));
  const otherCreditUsed = roundMoney(Math.min(otherCreditAfterPhaseout, nonrefundablePool - childCreditUsed));
  const unusedChildCredit = roundMoney(Math.max(0, childCreditAfterPhaseout - childCreditUsed));
  const refundableCap = roundMoney(children * ctc.refundablePerChild);
  const earnedLimit = roundMoney(Math.max(0, earnedIncome - ctc.earnedIncomeFloor) * ctc.earnedIncomeRate);
  const refundable = roundMoney(Math.min(unusedChildCredit, refundableCap, earnedLimit));
  return {
    childTaxCreditMax,
    otherDependentCreditMax,
    childTaxCredit: childCreditUsed,
    otherDependentCredit: otherCreditUsed,
    refundableChildTaxCredit: refundable,
  };
}

function estimateFederal(profile, rules, agi) {
  const standardDeduction = rules.standardDeduction[profile.filingStatus] ?? rules.standardDeduction.single;
  const deduction =
    profile.deductionMethod === "itemized" ? profile.itemizedDeduction : standardDeduction;
  const taxableIncome = roundMoney(Math.max(0, agi - deduction));
  const brackets = rules.brackets[profile.filingStatus] || rules.brackets.single;
  const taxBeforeCredits = taxFromBrackets(taxableIncome, brackets).tax;
  const credits = estimateCredits(profile, rules, agi, taxBeforeCredits, agi);
  const estimatedTax = roundMoney(Math.max(0, taxBeforeCredits - credits.childTaxCredit - credits.otherDependentCredit));
  const netAfterCredits = roundMoney(estimatedTax - credits.refundableChildTaxCredit);
  return {
    incomeAfterPretax: agi,
    standardDeduction,
    deduction,
    taxableIncome,
    taxBeforeCredits,
    ...credits,
    estimatedTax,
    netAfterCredits,
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

function estimateOhio(profile, agi, ohio) {
  const exemptionCount = ohioExemptionCount(profile);
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
  const estimatedTax = roundMoney(Math.max(0, afterExemptionCredit - jointFilingCredit));
  return {
    exemptionCount,
    exemptionPerPerson,
    personalExemptions,
    taxableIncome,
    taxBeforeCredits,
    personalExemptionCredit,
    jointFilingCredit,
    jointFilingCreditRate,
    estimatedTax,
    note: ohio.note || "",
  };
}

function estimateFlat(profile, agi, state) {
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
  const estimatedTax = roundMoney(Math.max(0, taxBeforeCredits - credit));
  return {
    rate: state.rate,
    standardDeduction,
    personalExemption,
    dependentExemption,
    zeroRateBand,
    taxableIncome,
    taxBeforeCredits,
    credit,
    estimatedTax,
    note: state.note || "",
  };
}

function estimateState(profile, year, agi) {
  const { rulesYear, rules } = getStateRules(year);
  const code = profile.stateCode;
  const base = {
    year: Number(year) || rulesYear,
    rulesYear,
    code,
    name: stateName(code) || code,
    usingPriorYearRules: rulesYear !== Number(year),
  };
  if (!code) {
    return {
      ...base,
      available: false,
      kind: "missing",
      message: "Add a state in your tax profile to estimate state income tax.",
      estimatedTax: null,
      detail: null,
    };
  }
  if (rules.noIncomeTax.includes(code)) {
    const name = stateName(code);
    const washington = code === "WA" ? " Washington's capital-gains tax is not part of this estimate." : "";
    return {
      ...base,
      name,
      available: true,
      kind: "none",
      message: `${name} has no tax on wages and ordinary income.${washington}`,
      estimatedTax: 0,
      detail: null,
    };
  }
  if (code === "OH" && rules.ohio) {
    const detail = estimateOhio(profile, agi, rules.ohio);
    return {
      ...base,
      available: true,
      kind: "ohio",
      message: "",
      estimatedTax: detail.estimatedTax,
      detail,
    };
  }
  const flat = (rules.flat || []).find((row) => row.code === code);
  if (flat) {
    const detail = estimateFlat(profile, agi, flat);
    return {
      ...base,
      name: flat.name,
      available: true,
      kind: "flat",
      message: "",
      estimatedTax: detail.estimatedTax,
      detail,
    };
  }
  const name = stateName(code) || code;
  return {
    ...base,
    name,
    available: false,
    kind: "unavailable",
    message: `State estimate not yet available for ${name}.`,
    estimatedTax: null,
    detail: null,
  };
}

function estimateLocal(profile, qualifyingWages) {
  const wages = roundMoney(Math.max(0, qualifyingWages));
  const cityTax = roundMoney(wages * profile.cityRate);
  const schoolDistrictTax = roundMoney(wages * profile.schoolDistrictRate);
  const estimatedTax = roundMoney(cityTax + schoolDistrictTax);
  return {
    city: profile.localJurisdiction,
    county: profile.localCounty,
    zip: profile.localZip,
    schoolDistrict: profile.schoolDistrict,
    cityRate: profile.cityRate,
    schoolDistrictRate: profile.schoolDistrictRate,
    qualifyingWages: wages,
    cityTax,
    schoolDistrictTax,
    estimatedTax,
  };
}

/** Employee Social Security and Medicare, including Additional Medicare when a filing status is known. */
export function ficaCheck({
  box3 = 0,
  box5 = 0,
  socialSecurityWithheld = 0,
  medicareWithheld = 0,
  filingStatus = null,
  rules,
} = {}) {
  const se = rules.selfEmployment;
  const socialSecurityRate = Math.round((se.socialSecurityRate / 2) * 1e6) / 1e6;
  const medicareRate = Math.round((se.medicareRate / 2) * 1e6) / 1e6;
  const additionalRate = se.additionalMedicareRate;
  const expectedSocialSecurity = roundMoney(nonNegativeMoney(box3) * socialSecurityRate);
  const expectedMedicareBase = roundMoney(nonNegativeMoney(box5) * medicareRate);
  let expectedAdditionalMedicare = 0;
  let additionalNote = "";
  if (filingStatus && se.additionalMedicareThreshold) {
    const threshold = se.additionalMedicareThreshold[filingStatus] ?? se.additionalMedicareThreshold.single;
    expectedAdditionalMedicare = roundMoney(Math.max(0, nonNegativeMoney(box5) - threshold) * additionalRate);
  } else {
    additionalNote = "Set up your tax profile to include Additional Medicare tax.";
  }
  const expectedMedicare = roundMoney(expectedMedicareBase + expectedAdditionalMedicare);
  const ssWithheld = nonNegativeMoney(socialSecurityWithheld);
  const medWithheld = nonNegativeMoney(medicareWithheld);
  const socialSecurityDifference = roundMoney(ssWithheld - expectedSocialSecurity);
  const medicareDifference = roundMoney(medWithheld - expectedMedicare);
  return {
    socialSecurityRate,
    medicareRate,
    additionalMedicareRate: additionalRate,
    expectedSocialSecurity,
    expectedMedicareBase,
    expectedAdditionalMedicare,
    expectedMedicare,
    socialSecurityWithheld: ssWithheld,
    medicareWithheld: medWithheld,
    socialSecurityDifference,
    medicareDifference,
    socialSecurityOver: socialSecurityDifference > FICA_OVER_TOLERANCE,
    medicareOver: medicareDifference > FICA_OVER_TOLERANCE,
    additionalNote,
    overTolerance: FICA_OVER_TOLERANCE,
  };
}

function federalRows(federal, profile) {
  const rows = [{ key: "agi", label: "Income after pre-tax", amount: federal.incomeAfterPretax }];
  rows.push({
    key: "deduction",
    label:
      profile.deductionMethod === "itemized"
        ? "Itemized deduction"
        : `Standard deduction (${profile.filingStatusShort})`,
    amount: -federal.deduction,
    signed: true,
  });
  rows.push({ key: "taxable", label: "Taxable income", amount: federal.taxableIncome, emphasis: true });
  rows.push({ key: "before", label: "Tax before credits", amount: federal.taxBeforeCredits });
  if (profile.childrenUnder17 > 0 || federal.childTaxCredit > 0) {
    rows.push({
      key: "ctc",
      label: `Child tax credit (${profile.childrenUnder17})`,
      amount: -federal.childTaxCredit,
      signed: true,
    });
  }
  if (profile.otherDependents > 0 || federal.otherDependentCredit > 0) {
    rows.push({
      key: "odc",
      label: `Credit for other dependents (${profile.otherDependents})`,
      amount: -federal.otherDependentCredit,
      signed: true,
    });
  }
  rows.push({
    key: "est",
    label: "Estimated federal tax",
    amount: federal.estimatedTax,
    emphasis: true,
  });
  if (federal.refundableChildTaxCredit > 0) {
    rows.push({
      key: "actc",
      label: "Refundable child tax credit",
      amount: -federal.refundableChildTaxCredit,
      signed: true,
    });
  }
  rows.push({ key: "withheld", label: "Federal withheld", amount: -federal.withheld, signed: true });
  const owed = balanceRow(federal.balance);
  if (owed) rows.push(owed);
  return rows;
}

function stateRows(state, withheld) {
  if (!state.available) {
    return [
      { key: "message", label: state.message, text: state.message },
      { key: "withheld", label: "State withheld", amount: -withheld, signed: true },
    ];
  }
  if (state.kind === "none") {
    const rows = [
      { key: "message", label: state.message, text: state.message },
      { key: "est", label: "Estimated state tax", amount: 0, emphasis: true },
      { key: "withheld", label: "State withheld", amount: -withheld, signed: true },
    ];
    const owed = balanceRow(state.balance);
    if (owed) rows.push(owed);
    return rows;
  }
  if (state.kind === "ohio") {
    const detail = state.detail;
    const exemptionLabel =
      detail.exemptionPerPerson > 0
        ? `Personal exemptions (${detail.exemptionCount} × $${detail.exemptionPerPerson.toLocaleString("en-US")})`
        : "Personal exemptions";
    const rows = [
      { key: "agi", label: "Ohio AGI (after pre-tax)", amount: state.incomeAfterPretax },
      { key: "exemptions", label: exemptionLabel, amount: -detail.personalExemptions, signed: true },
      { key: "taxable", label: "Ohio taxable income", amount: detail.taxableIncome, emphasis: true },
      { key: "before", label: "Tax before credits", amount: detail.taxBeforeCredits },
    ];
    if (detail.personalExemptionCredit > 0) {
      rows.push({
        key: "pec",
        label: "Personal exemption credit",
        amount: -detail.personalExemptionCredit,
        signed: true,
      });
    }
    if (detail.jointFilingCredit > 0) {
      const pct = Math.round(detail.jointFilingCreditRate * 100);
      rows.push({
        key: "jfc",
        label: `Joint filing credit (${pct}%)`,
        amount: -detail.jointFilingCredit,
        signed: true,
      });
    }
    rows.push(
      { key: "est", label: "Estimated Ohio tax", amount: detail.estimatedTax, emphasis: true },
      { key: "withheld", label: "State withheld", amount: -withheld, signed: true },
    );
    const owed = balanceRow(state.balance);
    if (owed) rows.push(owed);
    return rows;
  }
  const detail = state.detail;
  const rows = [{ key: "agi", label: "Income after pre-tax", amount: state.incomeAfterPretax }];
  if (detail.standardDeduction > 0) {
    rows.push({
      key: "std",
      label: "State standard deduction",
      amount: -detail.standardDeduction,
      signed: true,
    });
  }
  if (detail.personalExemption > 0) {
    rows.push({
      key: "pex",
      label: "Personal exemption",
      amount: -detail.personalExemption,
      signed: true,
    });
  }
  if (detail.dependentExemption > 0) {
    rows.push({
      key: "dex",
      label: "Dependent exemption",
      amount: -detail.dependentExemption,
      signed: true,
    });
  }
  if (detail.zeroRateBand > 0) {
    rows.push({ key: "zero", label: "Zero-rate band", amount: -detail.zeroRateBand, signed: true });
  }
  rows.push({ key: "taxable", label: "State taxable income", amount: detail.taxableIncome, emphasis: true });
  rows.push({
    key: "before",
    label: `Tax at ${percentText(detail.rate)}%`,
    amount: detail.taxBeforeCredits,
  });
  if (detail.credit > 0) {
    rows.push({ key: "credit", label: "State credit", amount: -detail.credit, signed: true });
  }
  rows.push(
    { key: "est", label: `Estimated ${state.name} tax`, amount: detail.estimatedTax, emphasis: true },
    { key: "withheld", label: "State withheld", amount: -withheld, signed: true },
  );
  const owed = balanceRow(state.balance);
  if (owed) rows.push(owed);
  return rows;
}

function localRows(local) {
  const cityName = local.city || "Local";
  const cityPct = percentText(local.cityRate);
  const rows = [{ key: "wages", label: "Qualifying wages", amount: local.qualifyingWages }];
  rows.push({
    key: "city",
    label: local.city ? `City of ${local.city} (${cityPct}%)` : `City tax (${cityPct}%)`,
    amount: local.cityTax,
  });
  if (local.schoolDistrictRate > 0) {
    const schoolName = local.schoolDistrict || "School district";
    rows.push({
      key: "sd",
      label: `${schoolName} (${percentText(local.schoolDistrictRate)}%)`,
      amount: local.schoolDistrictTax,
    });
  } else {
    rows.push({
      key: "sd",
      label: local.schoolDistrict ? `${local.schoolDistrict} income tax` : "School district income tax",
      amount: 0,
    });
  }
  rows.push(
    { key: "est", label: "Estimated local tax", amount: local.estimatedTax, emphasis: true },
    { key: "withheld", label: "Local withheld", amount: -local.withheld, signed: true },
  );
  const owed = balanceRow(local.balance);
  if (owed) rows.push(owed);
  return rows;
}

function localSubtitle(local) {
  const place = [local.city, local.county].filter(Boolean).join(", ");
  const bits = [place, local.zip ? `ZIP ${local.zip}` : "", local.schoolDistrict].filter(Boolean);
  return bits.join(" · ") || "Set a city rate and school district rate on your tax profile.";
}

/**
 * Estimate from paycheck wages and a saved household profile.
 * With no profile, wage bases and the Social Security / Medicare check still return,
 * and federal, state, and local tax are left unset.
 */
export function estimateHouseholdTax({
  year,
  profile: profileInput = null,
  gross = 0,
  deductions = {},
  withheld = {},
} = {}) {
  const profile = normalizeTaxProfile(profileInput);
  const withholding = normalizeWithholding(withheld);
  const { rulesYear, rules } = getFederalRules(year);
  const wageBase = Number(rules.selfEmployment?.socialSecurityWageBase) || null;
  const wages = wageBases({
    gross,
    deductions,
    stateCode: profile?.stateCode,
    localWageRule: profile?.localWageRule,
    socialSecurityWageBase: wageBase,
  });
  const fica = ficaCheck({
    box3: wages.box3,
    box5: wages.box5,
    socialSecurityWithheld: withholding.social_security,
    medicareWithheld: withholding.medicare,
    filingStatus: profile?.filingStatus || null,
    rules,
  });
  const wageView = {
    ...wages,
    figure: wageFigureLines(wages),
  };

  if (!profile) {
    return {
      profileMissing: true,
      year: Number(year) || rulesYear,
      rulesYear,
      usingPriorYearRules: rulesYear !== Number(year),
      wages: wageView,
      withholding,
      fica,
      federal: null,
      state: null,
      local: null,
    };
  }

  const federalCore = estimateFederal(profile, rules, wages.box1);
  const federalBalance = roundMoney(federalCore.netAfterCredits - withholding.federal);
  const federal = {
    available: true,
    ...federalCore,
    withheld: withholding.federal,
    ...balanceFields(federalBalance),
    filingStatus: profile.filingStatus,
    filingStatusLabel: profile.filingStatusLabel,
    childrenUnder17: profile.childrenUnder17,
    otherDependents: profile.otherDependents,
    deductionMethod: profile.deductionMethod,
    rulesYear,
    usingPriorYearRules: rulesYear !== Number(year),
  };
  federal.rows = federalRows(federal, profile);
  federal.subtitle = [
    profile.filingStatusLabel,
    profile.deductionMethod === "itemized" ? "Itemized deduction" : "Standard deduction",
    profile.childrenUnder17 === 1
      ? "1 child tax credit"
      : `${profile.childrenUnder17} child tax credits`,
    federal.usingPriorYearRules ? `Using ${rulesYear} IRS figures` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const stateCore = estimateState(profile, year, wages.box1);
  const stateBalance =
    stateCore.estimatedTax == null ? null : roundMoney(stateCore.estimatedTax - withholding.state);
  const state = {
    ...stateCore,
    incomeAfterPretax: wages.box1,
    withheld: withholding.state,
    ...balanceFields(stateBalance),
  };
  state.rows = stateRows(state, withholding.state);
  const dependentLabel =
    dependentCount(profile) === 1 ? "1 dependent" : `${dependentCount(profile)} dependents`;
  state.subtitle = state.available
    ? [
        state.kind === "none" ? state.message : profile.filingStatusLabel,
        state.kind === "ohio" ? "Personal exemptions" : "",
        state.kind === "ohio" ? dependentLabel : "",
        state.usingPriorYearRules ? `Using ${state.rulesYear} state figures` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : state.message;

  const localCore = estimateLocal(profile, wages.localWages);
  const localBalance = roundMoney(localCore.estimatedTax - withholding.local);
  const local = {
    available: true,
    ...localCore,
    withheld: withholding.local,
    ...balanceFields(localBalance),
    ruleLabel: wages.localRule?.label || "",
  };
  local.rows = localRows(local);
  local.subtitle = localSubtitle(local);

  return {
    profileMissing: false,
    year: Number(year) || rulesYear,
    rulesYear,
    usingPriorYearRules: rulesYear !== Number(year),
    wages: wageView,
    withholding,
    fica,
    federal,
    state,
    local,
  };
}
