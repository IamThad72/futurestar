/** Label matching for the stored tax-page totals. Hyphens count as spaces ("Gross-Income"). */

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

function looksLikeNetIncome(category, subCategory = null) {
  const cat = normLabel(category);
  const sub = normLabel(subCategory);
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
  const cat = normLabel(category);
  const sub = normLabel(subCategory);
  const looksGross = (t) =>
    t === "gross" ||
    t.includes("gross income") ||
    t.includes("gross pay") ||
    t.includes("gross salary") ||
    t.includes("gross wages");
  if (looksGross(cat) || looksGross(sub)) return "gross";
  if (/payroll/i.test(String(category || "").trim())) return "gross";
  return null;
}

export function classifyFiscalPretaxKind(category, subCategory = null) {
  const blob = labelBlob(category, subCategory);
  if (!blob) return null;
  if (/dental/.test(blob)) return "dental";
  if (/vision/.test(blob)) return "vision";
  if (/\bhsa\b|health\s*savings/.test(blob)) return "hsa";
  if (/\b401\s*[\(\s-]*k\b/.test(blob)) return "401k";
  if (/medical|family\s*(health\s*)?insurance|health\s*insurance/.test(blob)) return "medical";
  return null;
}

export function classifyFiscalPosttaxKind(category, subCategory = null) {
  const blob = labelBlob(category, subCategory);
  if (!blob) return null;
  if (/supplemental\s*life/.test(blob) || /supp\.?\s*life/.test(blob) || /voluntary\s*life/.test(blob)) {
    return "supplemental_life";
  }
  if (/stock\s*option\s*offset|stock\s*option|rsu\s*offset|option\s*offset/.test(blob)) {
    return "stock_option_offset";
  }
  return null;
}
