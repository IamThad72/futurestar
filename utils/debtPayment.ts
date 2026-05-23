/** Loan types treated as revolving (full payment reduces balance). */
const REVOLVING_TYPE_KEYWORDS = ["credit card", "creditcard", "revolving"];

export type DebtRow = {
  dbt_id?: number;
  loan_type?: string | null;
  loan_ammount?: unknown;
  is_revolving?: boolean | null;
  interest_rate_annual?: number | string | null;
  term_months?: number | string | null;
  scheduled_monthly_payment?: number | string | null;
  loan_start_date?: string | null;
};

export function parseMoney(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = Number(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function inferIsRevolvingDebt(debt: DebtRow | null | undefined): boolean {
  if (!debt) return true;
  if (debt.is_revolving === true) return true;
  if (debt.is_revolving === false) return false;
  const lt = (debt.loan_type ?? "").trim().toLowerCase();
  return REVOLVING_TYPE_KEYWORDS.some((k) => lt.includes(k));
}

/** Split a payment into interest and principal (installment / mortgage). */
export function splitInstallmentPayment(
  principalBalance: number,
  paymentAmount: number,
  annualRatePct: number | null | undefined,
): { principal: number; interest: number } {
  const balance = Math.max(0, principalBalance);
  const payment = Math.max(0, paymentAmount);
  if (payment <= 0 || balance <= 0) {
    return { principal: 0, interest: 0 };
  }

  const rate = annualRatePct != null ? Number(annualRatePct) : 0;
  if (!Number.isFinite(rate) || rate <= 0) {
    return {
      principal: Math.min(payment, balance),
      interest: 0,
    };
  }

  const monthlyInterest = Math.round(balance * (rate / 100 / 12) * 100) / 100;
  const principal = Math.min(Math.max(0, payment - monthlyInterest), balance);
  const interest = Math.min(monthlyInterest, payment);
  return { principal, interest };
}

export function computeDebtPaymentApplication(
  debt: DebtRow,
  paymentAmount: number,
): { principal: number; interest: number; isRevolving: boolean } {
  const balance = parseMoney(debt.loan_ammount);
  const isRevolving = inferIsRevolvingDebt(debt);

  if (isRevolving) {
    return {
      isRevolving: true,
      principal: Math.min(Math.max(0, paymentAmount), balance > 0 ? balance : paymentAmount),
      interest: 0,
    };
  }

  const split = splitInstallmentPayment(balance, paymentAmount, debt.interest_rate_annual);
  return {
    isRevolving: false,
    principal: split.principal,
    interest: split.interest,
  };
}
