import { roundMoney } from "./money.js";

/**
 * Map a budget income line onto the tax profile's income types.
 * Tax withholding and payroll deductions are not income.
 * Gross pay is W-2 wages unless the label says self-employment or retirement.
 */
export function annualAmount(line) {
  const annual = Number(line?.annual_amount ?? line?.annualAmount ?? line?.income_category_annual_amt);
  if (Number.isFinite(annual)) return roundMoney(Math.max(0, annual));
  const monthly = Number(line?.monthly_amount ?? line?.monthlyAmount ?? line?.income_category_monthly_amt);
  if (Number.isFinite(monthly)) return roundMoney(Math.max(0, monthly) * 12);
  return 0;
}

function lineText(line) {
  return [line?.category, line?.sub_category, line?.subCategory, line?.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function classifyBudgetIncomeLine(line) {
  const type = String(line?.income_type || line?.incomeType || "gross").trim().toLowerCase();
  if (type === "tax" || type === "deduction") return null;
  const annual = annualAmount(line);
  const text = lineText(line);
  if (/self[-\s]?employ|1099|schedule\s*c|freelance|contractor|business income/.test(text)) {
    return { bucket: "self_employment", annual };
  }
  if (/pension|annuit|ira\b|401\(k\) distribution|social security benefit|retirement/.test(text)) {
    return { bucket: "retirement", annual };
  }
  if (type === "interest" || type === "other") return { bucket: "other_income", annual };
  if (type === "gross") return { bucket: "wages", annual };
  return { bucket: "other_income", annual };
}

export function emptyBudgetIncome() {
  return {
    wages: 0,
    self_employment: 0,
    retirement: 0,
    other_income: 0,
  };
}

/** Sum budget lines. This is the income the tax estimate uses when the profile follows the budget. */
export function summarizeBudgetIncome(lines) {
  const totals = emptyBudgetIncome();
  for (const line of lines || []) {
    const classified = classifyBudgetIncomeLine(line);
    if (!classified) continue;
    totals[classified.bucket] = roundMoney(totals[classified.bucket] + classified.annual);
  }
  return totals;
}

export function budgetIncomeTotal(income) {
  const row = income || emptyBudgetIncome();
  return roundMoney(
    (Number(row.wages) || 0) +
      (Number(row.self_employment) || 0) +
      (Number(row.retirement) || 0) +
      (Number(row.other_income) || 0),
  );
}
