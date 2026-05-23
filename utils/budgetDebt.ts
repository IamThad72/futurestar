/** Keywords suggesting a budget expense maps to Estate Management debt (loans / cards). */
const LOAN_CREDIT_KEYWORDS = [
  "credit card",
  "creditcard",
  "card payment",
  "loan",
  "mortgage",
  "heloc",
  "line of credit",
  "auto loan",
  "car loan",
  "student loan",
  "personal loan",
  "installment loan",
  "debt payment",
  "refinance",
];

export function isDebtBudgetCategory(category: string | null | undefined): boolean {
  return (category ?? "").trim().toLowerCase() === "debt";
}

export function textLooksLikeLoanOrCreditCard(
  category: string | null | undefined,
  subCategory: string | null | undefined,
  description: string | null | undefined,
): boolean {
  const blob = [category, subCategory, description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return LOAN_CREDIT_KEYWORDS.some((k) => blob.includes(k));
}

/** Budget setup / tracker: expense line should be tied to an Estate Management debt record. */
export function budgetExpenseNeedsDebtLink(
  category: string | null | undefined,
  subCategory: string | null | undefined,
  description: string | null | undefined,
): boolean {
  return isDebtBudgetCategory(category) || textLooksLikeLoanOrCreditCard(category, subCategory, description);
}

export function formatDebtRecordLabel(row: {
  dbt_id?: number;
  institution?: string | null;
  loan_type?: string | null;
}): string {
  const inst = (row?.institution ?? "").trim();
  const lt = (row?.loan_type ?? "").trim();
  if (inst && lt) return `${inst} — ${lt}`;
  if (inst) return inst;
  if (lt) return lt;
  return `Debt #${row?.dbt_id ?? "?"}`;
}
