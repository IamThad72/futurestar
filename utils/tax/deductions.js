import deductionFile from "../../data/tax/deduction_types.json" with { type: "json" };
import localWageFile from "../../data/tax/local_wage_rules.json" with { type: "json" };
import { nonNegativeMoney, roundMoney } from "./money.js";

const TYPES = deductionFile.types.map((type) => ({
  ...type,
  regexes: (type.patterns || []).map((pattern) => new RegExp(pattern, "i")),
}));

const MATCH_ORDER = [
  ...TYPES.filter((type) => type.section === "posttax"),
  ...TYPES.filter((type) => type.section === "pretax"),
];

export const FISCAL_PRETAX_KINDS = TYPES.filter((type) => type.section === "pretax").map((type) => type.key);
export const FISCAL_POSTTAX_KINDS = TYPES.filter((type) => type.section === "posttax").map((type) => type.key);

export const FISCAL_PRETAX_KIND_LABELS = Object.fromEntries(
  TYPES.filter((type) => type.section === "pretax").map((type) => [type.key, type.label]),
);
export const FISCAL_POSTTAX_KIND_LABELS = Object.fromEntries(
  TYPES.filter((type) => type.section === "posttax").map((type) => [type.key, type.label]),
);

/** Kinds the tax page has always listed, even when the amount is zero. */
export const ALWAYS_SHOWN_PRETAX = ["medical", "dental", "vision", "401k", "hsa"];
export const ALWAYS_SHOWN_POSTTAX = ["supplemental_life", "stock_option_offset"];

export const LOCAL_WAGE_RULES = localWageFile.rules;
export const DEFAULT_LOCAL_WAGE_RULE_ID = localWageFile.defaultRuleId;

export function deductionTypes() {
  return TYPES.map((type) => ({
    key: type.key,
    label: type.label,
    section: type.section,
    class: type.class,
    reduces: type.reduces,
  }));
}

export function deductionTypeByKey(key) {
  return TYPES.find((type) => type.key === key) || null;
}

export function normFiscalLabel(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

function labelBlob(category, subCategory) {
  return `${normFiscalLabel(category)} ${normFiscalLabel(subCategory)}`.trim();
}

export function looksLikeNetIncome(category, subCategory = null) {
  const cat = normFiscalLabel(category);
  const sub = normFiscalLabel(subCategory);
  if (
    /\bnet\s+income\b/.test(sub) ||
    /\bnet\s+pay\b/.test(sub) ||
    sub === "net" ||
    sub.includes("take home") ||
    sub.includes("take-home")
  ) {
    return true;
  }
  return /\bnet\s+income\b/.test(cat) || /\bnet\s+pay\b/.test(cat);
}

export function classifyFiscalIncomeKind(category, subCategory = null) {
  if (looksLikeNetIncome(category, subCategory)) return "net";
  const cat = normFiscalLabel(category);
  const sub = normFiscalLabel(subCategory);
  const looksGross = (text) =>
    text === "gross" ||
    text.includes("gross income") ||
    text.includes("gross pay") ||
    text.includes("gross salary") ||
    text.includes("gross wages");
  if (looksGross(cat) || looksGross(sub)) return "gross";
  if (/payroll/i.test(String(category || "").trim())) return "gross";
  return null;
}

function overrideKey(category, subCategory, overrides) {
  const cat = normFiscalLabel(category);
  const sub = normFiscalLabel(subCategory);
  for (const row of overrides || []) {
    const rowCat = normFiscalLabel(row.category ?? row.income_category);
    const rowSub = normFiscalLabel(row.subCategory ?? row.sub_category);
    if (rowCat === cat && rowSub === sub) {
      return String(row.deductionKey ?? row.deduction_key ?? "").trim();
    }
  }
  return null;
}

/** Budget line to a deduction type, honoring a household override first. */
export function classifyDeductionType(category, subCategory = null, overrides = null) {
  const chosen = overrideKey(category, subCategory, overrides);
  if (chosen != null) {
    if (!chosen || chosen === "ignore" || chosen === "none") return null;
    return deductionTypeByKey(chosen);
  }
  const blob = labelBlob(category, subCategory);
  if (!blob) return null;
  for (const type of MATCH_ORDER) {
    if (type.regexes.some((regex) => regex.test(blob))) return type;
  }
  return null;
}

export function classifyFiscalPretaxKind(category, subCategory = null, overrides = null) {
  const type = classifyDeductionType(category, subCategory, overrides);
  return type && type.section === "pretax" ? type.key : null;
}

export function classifyFiscalPosttaxKind(category, subCategory = null, overrides = null) {
  const type = classifyDeductionType(category, subCategory, overrides);
  return type && type.section === "posttax" ? type.key : null;
}

export function resolveLocalWageRule(stateCode, ruleId) {
  const requested = String(ruleId || "").trim();
  if (requested) {
    const chosen = LOCAL_WAGE_RULES.find((rule) => rule.id === requested);
    if (chosen) return chosen;
  }
  const state = String(stateCode || "").trim().toUpperCase();
  const forState = LOCAL_WAGE_RULES.find((rule) => (rule.states || []).includes(state));
  if (forState) return forState;
  return (
    LOCAL_WAGE_RULES.find((rule) => rule.id === DEFAULT_LOCAL_WAGE_RULE_ID) || LOCAL_WAGE_RULES[0]
  );
}

function typeReducesLocal(type, rule) {
  if (type.reduces?.local === false) return false;
  if (type.reduces?.local === true) return true;
  return (rule?.subtractClasses || []).includes(type.class);
}

function emptyBuckets() {
  return {
    federalIncome: 0,
    stateIncome: 0,
    socialSecurity: 0,
    medicare: 0,
    local: 0,
    section125: 0,
    retirementPretax: 0,
    posttax: 0,
  };
}

/**
 * W-2 style wages from gross pay and deduction amounts.
 * Box 1 is gross minus every pre-tax type. Box 3 and Box 5 subtract Section 125 only.
 * Box 3 is capped at the Social Security wage base. Local wages follow the jurisdiction rule.
 */
export function wageBases({
  gross = 0,
  deductions = {},
  stateCode = null,
  localWageRule = null,
  socialSecurityWageBase = null,
} = {}) {
  const grossWages = nonNegativeMoney(gross);
  const rule = resolveLocalWageRule(stateCode, localWageRule);
  const buckets = emptyBuckets();
  const details = [];

  for (const type of TYPES) {
    const amount = nonNegativeMoney(deductions?.[type.key]);
    if (amount <= 0) continue;
    if (type.reduces?.federalIncome) buckets.federalIncome = roundMoney(buckets.federalIncome + amount);
    if (type.reduces?.stateIncome) buckets.stateIncome = roundMoney(buckets.stateIncome + amount);
    if (type.reduces?.socialSecurity) buckets.socialSecurity = roundMoney(buckets.socialSecurity + amount);
    if (type.reduces?.medicare) buckets.medicare = roundMoney(buckets.medicare + amount);
    if (type.class === "section125") buckets.section125 = roundMoney(buckets.section125 + amount);
    if (type.class === "retirement_pretax") {
      buckets.retirementPretax = roundMoney(buckets.retirementPretax + amount);
    }
    if (type.class === "posttax") buckets.posttax = roundMoney(buckets.posttax + amount);
    if (typeReducesLocal(type, rule)) buckets.local = roundMoney(buckets.local + amount);
    details.push({
      key: type.key,
      label: type.label,
      class: type.class,
      section: type.section,
      amount,
    });
  }

  const cap = Number(socialSecurityWageBase);
  const wageCap = Number.isFinite(cap) && cap > 0 ? cap : Number.POSITIVE_INFINITY;
  const box1 = roundMoney(Math.max(0, grossWages - buckets.federalIncome));
  const ssUncapped = roundMoney(Math.max(0, grossWages - buckets.socialSecurity));
  const box3 = roundMoney(Math.min(ssUncapped, wageCap));
  const box5 = roundMoney(Math.max(0, grossWages - buckets.medicare));
  const localWages = roundMoney(Math.max(0, grossWages - buckets.local));

  return {
    gross: grossWages,
    box1,
    box3,
    box5,
    socialSecurityWagesUncapped: ssUncapped,
    socialSecurityWageBase: Number.isFinite(cap) && cap > 0 ? cap : null,
    localWages,
    localRule: rule,
    section125: buckets.section125,
    retirementPretax: buckets.retirementPretax,
    posttax: buckets.posttax,
    details,
  };
}

/** Gross − traditional retirement − Section 125 = Box 1, with each non-zero line under its group. */
export function wageFigureLines(bases) {
  const lines = [{ key: "gross", label: "Gross wages", amount: bases.gross }];
  if (bases.retirementPretax > 0) {
    lines.push({
      key: "retirement",
      label: "Traditional 401(k), 403(b), 457, and TSP",
      amount: -bases.retirementPretax,
      signed: true,
    });
    for (const detail of bases.details.filter((row) => row.class === "retirement_pretax")) {
      lines.push({
        key: `detail-${detail.key}`,
        label: detail.label,
        amount: -detail.amount,
        signed: true,
        detail: true,
      });
    }
  }
  if (bases.section125 > 0) {
    lines.push({
      key: "section125",
      label: "Section 125 (medical, dental, vision, HSA, FSA, commuter)",
      amount: -bases.section125,
      signed: true,
    });
    for (const detail of bases.details.filter((row) => row.class === "section125")) {
      lines.push({
        key: `detail-${detail.key}`,
        label: detail.label,
        amount: -detail.amount,
        signed: true,
        detail: true,
      });
    }
  }
  if (bases.posttax > 0) {
    lines.push({
      key: "posttax",
      label: "Post-tax (not subtracted)",
      amount: bases.posttax,
    });
  }
  lines.push({ key: "box1", label: "W-2 Box 1", amount: bases.box1, emphasis: true });
  return lines;
}

const DISPLAY_ORDER = {
  pretax: ["medical", "dental", "vision", "401k", "hsa", "fsa", "commuter", "403b", "457", "tsp"],
  posttax: ["supplemental_life", "stock_option_offset", "roth_401k", "union_dues", "garnishments"],
};

export function deductionRows(section, amounts, { always = [] } = {}) {
  const rows = [];
  for (const type of TYPES.filter((item) => item.section === section)) {
    const amount = nonNegativeMoney(amounts?.[type.key]);
    if (amount <= 0 && !always.includes(type.key)) continue;
    rows.push({ key: type.key, label: type.label, amount, class: type.class });
  }
  const order = DISPLAY_ORDER[section] || [];
  rows.sort((a, b) => {
    const ai = order.indexOf(a.key);
    const bi = order.indexOf(b.key);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return rows;
}
