/** Label matching for the stored tax-page totals. Hyphens count as spaces ("Gross-Income"). */

export {
  classifyFiscalIncomeKind,
  classifyFiscalPosttaxKind,
  classifyFiscalPretaxKind,
  looksLikeNetIncome,
} from "./tax/deductions.js";

function normLabel(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

function labelBlob(category, subCategory) {
  return `${normLabel(category)} ${normLabel(subCategory)}`.trim();
}

export function classifyTaxAnnualKind(category, subCategory = null) {
  const blob = labelBlob(category, subCategory);
  if (!blob) return null;
  if (/social\s*security|fica|\boasdi\b/.test(blob)) return "social_security";
  if (/medicare/.test(blob)) return "medicare";
  if (/federal|\bfed\b/.test(blob)) return "federal";
  if (/local|city|county|municipal/.test(blob)) return "local";
  if (/state/.test(blob)) return "state";
  return null;
}
