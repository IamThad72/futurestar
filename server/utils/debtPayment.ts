import { createError } from "h3";
import { computeDebtPaymentApplication, parseMoney } from "../../utils/debtPayment";

type DbClient = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number }>;
};

export type DebtPaymentResult = {
  principal: number;
  interest: number;
  isRevolving: boolean;
};

export async function fetchDebtForUser(
  client: DbClient,
  debtId: number,
  userId: number,
  groupId: number | null,
): Promise<Record<string, unknown> | null> {
  const result = groupId
    ? await client.query(
        `SELECT dbt_id, loan_type, loan_ammount, is_revolving, interest_rate_annual, term_months, scheduled_monthly_payment, loan_start_date
         FROM debt
         WHERE dbt_id = $1 AND (user_id = $2 OR group_id = $3 OR user_id IN (SELECT user_id FROM group_members WHERE group_id = $3))`,
        [debtId, userId, groupId],
      )
    : await client.query(
        `SELECT dbt_id, loan_type, loan_ammount, is_revolving, interest_rate_annual, term_months, scheduled_monthly_payment, loan_start_date
         FROM debt WHERE dbt_id = $1 AND user_id = $2`,
        [debtId, userId],
      );
  return result.rows[0] ?? null;
}

export async function applyDebtPayment(
  client: DbClient,
  debtId: number,
  paymentAmount: number,
  userId: number,
  groupId: number | null,
): Promise<DebtPaymentResult> {
  const debt = await fetchDebtForUser(client, debtId, userId, groupId);
  if (!debt) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid debt record.",
    });
  }

  const { principal, interest, isRevolving } = computeDebtPaymentApplication(debt, paymentAmount);
  if (principal > 0) {
    await client.query(
      `UPDATE debt SET loan_ammount = GREATEST((COALESCE(loan_ammount::numeric, 0) - $1), 0)::money WHERE dbt_id = $2`,
      [principal, debtId],
    );
  }

  return { principal, interest, isRevolving };
}

export async function reverseDebtPayment(
  client: DbClient,
  debtId: number,
  principalToRestore: number,
): Promise<void> {
  const principal = Number(principalToRestore);
  if (!principal || isNaN(principal) || principal <= 0) return;
  await client.query(
    `UPDATE debt SET loan_ammount = (COALESCE(loan_ammount::numeric, 0) + $1)::money WHERE dbt_id = $2`,
    [principal, debtId],
  );
}

export function formatDebtBalance(debt: Record<string, unknown> | null): number {
  return parseMoney(debt?.loan_ammount);
}
