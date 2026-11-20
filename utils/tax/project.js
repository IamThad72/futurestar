import { classifyTaxAnnualKind } from "../annualTotals.js";
import {
  classifyDeductionType,
  classifyFiscalIncomeKind,
} from "./deductions.js";
import { nonNegativeMoney, roundMoney } from "./money.js";

function scaleMap(map, scale) {
  const out = {};
  for (const [key, value] of Object.entries(map || {})) {
    out[key] = roundMoney((Number(value) || 0) * scale);
  }
  return out;
}

/**
 * Full-year amounts from year-to-date paychecks, or from the budget plan when
 * a paycheck count is not available. Tax is computed on these amounts later;
 * the owed or refund figure is not itself annualized.
 */
export function projectFullYear({
  gross = 0,
  deductions = {},
  withheld = {},
  paychecksSoFar = null,
  paychecksPerYear = null,
  budgetPlan = null,
} = {}) {
  const soFar = Number(paychecksSoFar);
  const perYear = Number(paychecksPerYear);
  if (soFar > 0 && perYear > 0) {
    const scale = perYear / soFar;
    return {
      available: true,
      method: "paychecks",
      label: `Year to date × ${perYear} paychecks / ${soFar} so far`,
      paychecksSoFar: soFar,
      paychecksPerYear: perYear,
      gross: roundMoney(nonNegativeMoney(gross) * scale),
      deductions: scaleMap(deductions, scale),
      withheld: scaleMap(withheld, scale),
    };
  }

  const planGross = nonNegativeMoney(budgetPlan?.gross);
  if (budgetPlan && planGross > 0) {
    return {
      available: true,
      method: "budget",
      label: "Active budget annual amounts",
      paychecksSoFar: soFar > 0 ? soFar : null,
      paychecksPerYear: perYear > 0 ? perYear : null,
      gross: planGross,
      deductions: budgetPlan.deductions || {},
      withheld: budgetPlan.withholding || budgetPlan.withheld || {},
    };
  }

  return {
    available: false,
    method: null,
    label: "Add paychecks per year on your tax profile, or annual amounts on the budget, to project a full year.",
    paychecksSoFar: soFar > 0 ? soFar : null,
    paychecksPerYear: perYear > 0 ? perYear : null,
    gross: 0,
    deductions: {},
    withheld: {},
  };
}

/** Annual budget lines classified the same way paycheck totals are classified. */
export function summarizeBudgetPlan(lines, overrides = null) {
  const deductions = {};
  const withholding = {
    federal: 0,
    state: 0,
    local: 0,
    medicare: 0,
    social_security: 0,
  };
  let gross = 0;
  let net = 0;

  for (const line of lines || []) {
    const annual = Number(line.annualAmount ?? line.annual_amount);
    if (!Number.isFinite(annual) || annual === 0) continue;
    const amount = Math.abs(annual);
    const itemKind = String(line.itemKind || line.item_kind || "income").toLowerCase();
    const itemType = String(line.itemType || line.item_type || "").toLowerCase();
    const category = line.category;
    const subCategory = line.subCategory ?? line.sub_category;

    if (itemKind === "income" && itemType === "tax") {
      const taxKind = classifyTaxAnnualKind(category, subCategory);
      if (taxKind) withholding[taxKind] = roundMoney(withholding[taxKind] + amount);
      continue;
    }

    if (itemKind === "income" && itemType === "deduction") {
      const deduction = classifyDeductionType(category, subCategory, overrides);
      if (deduction) {
        deductions[deduction.key] = roundMoney((deductions[deduction.key] || 0) + amount);
      }
      continue;
    }

    if (itemKind === "expense" && (itemType === "savings" || itemType === "investment")) {
      const deduction = classifyDeductionType(category, subCategory, overrides);
      if (deduction?.section === "pretax") {
        deductions[deduction.key] = roundMoney((deductions[deduction.key] || 0) + amount);
      }
      continue;
    }

    if (itemKind === "income" && (itemType === "gross" || itemType === "interest" || itemType === "other" || !itemType)) {
      const incomeKind = classifyFiscalIncomeKind(category, subCategory);
      if (incomeKind === "gross") gross = roundMoney(gross + amount);
      if (incomeKind === "net") net = roundMoney(net + amount);
    }
  }

  return { gross, net, deductions, withholding };
}
