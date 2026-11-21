import {
  ALWAYS_SHOWN_POSTTAX,
  ALWAYS_SHOWN_PRETAX,
  deductionRows,
} from "./deductions.js";
import { estimateHouseholdTax } from "./estimate.js";
import { normalizeTaxProfile, normalizeWithholding } from "./profile.js";
import { projectFullYear } from "./project.js";

export const TAX_ESTIMATE_DISCLAIMER = "This is an estimate, not tax advice or a filing.";

const TAX_KIND_ORDER = [
  { key: "federal", label: "Federal" },
  { key: "state", label: "State" },
  { key: "local", label: "Local" },
  { key: "medicare", label: "Medicare" },
  { key: "social_security", label: "Social Security" },
];

function sumAmounts(rows) {
  return rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

function comparisonRow(key, label, ytdPart, projectedPart) {
  const ytdBalance = ytdPart && ytdPart.balance != null && ytdPart.available !== false ? ytdPart.balance : null;
  const projectedBalance =
    projectedPart && projectedPart.balance != null && projectedPart.available !== false
      ? projectedPart.balance
      : null;
  return {
    key,
    label,
    ytdBalance,
    projectedBalance,
    ytdAvailable: ytdBalance != null,
    projectedAvailable: projectedBalance != null,
  };
}

/**
 * View model for the tax page. Profile load failure leaves withholding in place
 * and does not invent a filing status.
 */
export function buildTaxPageModel({
  year,
  profile = null,
  profileUnavailable = false,
  gross = 0,
  net = 0,
  deductions = {},
  withholding = {},
  paychecksSoFar = null,
  budgetPlan = null,
} = {}) {
  const withheld = normalizeWithholding(withholding);
  const normalized = profileUnavailable ? null : normalizeTaxProfile(profile);
  const ytd = estimateHouseholdTax({
    year,
    profile: normalized,
    gross,
    deductions,
    withheld,
  });
  const projection = projectFullYear({
    gross,
    deductions,
    withheld,
    paychecksSoFar,
    paychecksPerYear: normalized?.paychecksPerYear ?? null,
    budgetPlan,
  });
  const projectedEstimate = projection.available
    ? estimateHouseholdTax({
        year,
        profile: normalized,
        gross: projection.gross,
        deductions: projection.deductions,
        withheld: projection.withheld,
      })
    : null;

  const preTaxRows = deductionRows("pretax", deductions, { always: ALWAYS_SHOWN_PRETAX });
  const postTaxRows = deductionRows("posttax", deductions, { always: ALWAYS_SHOWN_POSTTAX });
  const taxRows = TAX_KIND_ORDER.map((row) => ({
    ...row,
    amount: withheld[row.key] || 0,
  }));
  const incomeRows = [
    { key: "gross", label: "Gross Income", amount: ytd.wages.gross },
    { key: "taxable", label: "Taxable Income", amount: ytd.wages.box1 },
    { key: "net", label: "Net Income", amount: Number(net) || 0 },
  ];

  const profileMissing = !profileUnavailable && !normalized;
  const hasProfile = Boolean(normalized);

  return {
    year: ytd.year,
    profileMissing,
    profileUnavailable: Boolean(profileUnavailable),
    withholding: withheld,
    incomeRows,
    taxRows,
    preTaxRows,
    postTaxRows,
    taxSectionTotal: sumAmounts(taxRows),
    preTaxSectionTotal: sumAmounts(preTaxRows),
    postTaxSectionTotal: sumAmounts(postTaxRows),
    wageFigure: ytd.wages.figure,
    wages: ytd.wages,
    ytd,
    projected: {
      available: Boolean(projectedEstimate),
      method: projection.method,
      label: projection.label,
      paychecksSoFar: projection.paychecksSoFar,
      paychecksPerYear: projection.paychecksPerYear,
      estimate: projectedEstimate,
    },
    comparison: hasProfile
      ? [
          comparisonRow("federal", "Federal", ytd.federal, projectedEstimate?.federal),
          comparisonRow("state", "State", ytd.state, projectedEstimate?.state),
          comparisonRow("local", "Local", ytd.local, projectedEstimate?.local),
        ]
      : [],
  };
}
