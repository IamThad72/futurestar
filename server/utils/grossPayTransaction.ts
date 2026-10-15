import { applyFiscalTotalsForTransaction, classifyFiscalIncomeKind } from "./fiscalAnnualTotals";
import { adjustTaxAnnualTotalForClassification, yearFromDateString } from "./taxAnnualTotals";
import { reverseDebtPayment } from "./debtPayment";
import { groupAccessClauseAt, soloUserClauseAt } from "./group";

type DbClient = {
  query: (queryText: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
};

const PAY_BATCH_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GROSS_PAY_TX_COLUMNS = `
  transaction_id, debt_id, amount, principal_applied, income_id, expense_id,
  transaction_date, item_kind, item_type, category, sub_category, from_gross_pay,
  cash_investment_id, from_cash_investment_id, description, created_at, pay_batch_id
`;

export function parsePayBatchId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return PAY_BATCH_UUID.test(trimmed) ? trimmed : null;
}

export function isFromGrossPay(value: unknown) {
  return value === true || value === "t" || value === "true";
}

/** Calendar date for a pg DATE (parsed as local midnight). */
export function transactionDateIso(value: unknown): string {
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

/** The gross-income row of a paycheck. Deleting it undoes the whole paycheck. */
export function isGrossPaycheckAnchor(row: Record<string, unknown>) {
  if (!isFromGrossPay(row?.from_gross_pay)) return false;
  const kind = String(row.item_kind || "").toLowerCase();
  if (kind === "expense") return false;
  if (kind !== "income" && !(row.income_id != null && Number(row.income_id) > 0)) return false;
  return classifyFiscalIncomeKind(
    row.category != null ? String(row.category) : null,
    row.sub_category != null ? String(row.sub_category) : null,
  ) === "gross";
}

function accessClause(alias: string, userParam: number, groupId: number | null) {
  return groupId
    ? groupAccessClauseAt(alias, userParam, userParam + 1)
    : soloUserClauseAt(alias, userParam);
}

function accessParams(userId: number, groupId: number | null) {
  return groupId ? [userId, groupId] : [userId];
}

/**
 * Rows that belong to the same paycheck as this gross-income transaction.
 * New paychecks share pay_batch_id. Older ones are the from_gross_pay rows
 * saved together (same date, description, and a few minutes of created_at).
 */
export async function loadPaycheckRows(
  client: DbClient,
  userId: number,
  groupId: number | null,
  anchor: Record<string, unknown>,
) {
  if (!isGrossPaycheckAnchor(anchor)) return [anchor];

  const batchId = anchor.pay_batch_id != null ? String(anchor.pay_batch_id) : "";
  if (batchId && parsePayBatchId(batchId)) {
    const userParam = 2;
    const params = [batchId, ...accessParams(userId, groupId)];
    const result = await client.query(
      `SELECT ${GROSS_PAY_TX_COLUMNS}
       FROM budget_transactions t
       WHERE t.pay_batch_id = $1::uuid
         AND ${accessClause("t", userParam, groupId)}
       FOR UPDATE`,
      params,
    );
    if (result.rows.length) return result.rows;
  }

  const dateIso = transactionDateIso(anchor.transaction_date);
  const createdAt = anchor.created_at instanceof Date ? anchor.created_at : null;
  if (!dateIso || !createdAt) return [anchor];

  const userParam = 4;
  const params = [dateIso, anchor.description ?? null, createdAt, ...accessParams(userId, groupId)];
  const result = await client.query(
    `SELECT ${GROSS_PAY_TX_COLUMNS}
     FROM budget_transactions t
     WHERE t.from_gross_pay IS TRUE
       AND t.pay_batch_id IS NULL
       AND t.transaction_date = $1::date
       AND t.description IS NOT DISTINCT FROM $2
       AND t.created_at BETWEEN $3::timestamptz - interval '5 minutes'
                            AND $3::timestamptz + interval '5 minutes'
       AND ${accessClause("t", userParam, groupId)}
     FOR UPDATE`,
    params,
  );

  const rows = result.rows.length ? result.rows : [anchor];
  const anchorId = Number(anchor.transaction_id);
  if (!rows.some((row) => Number(row.transaction_id) === anchorId)) rows.push(anchor);
  return rows;
}

function positiveAmount(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return amount;
}

async function reverseCashEffects(client: DbClient, row: Record<string, unknown>) {
  const amount = positiveAmount(row.amount);
  if (!amount) return;

  const itemKind =
    String(row.item_kind || "").toLowerCase() === "expense" ||
    (row.income_id == null && row.expense_id != null)
      ? "expense"
      : "income";
  const itemType = String(row.item_type || "").toLowerCase();
  const destinationId = Number(row.cash_investment_id);
  const sourceId = Number(row.from_cash_investment_id);

  if (itemKind === "expense" && Number.isFinite(sourceId) && sourceId > 0) {
    await client.query(
      `UPDATE cash_and_investments SET value = COALESCE(value::numeric, 0) + $1 WHERE ci_id = $2`,
      [amount, sourceId],
    );
  }

  const reversesDestination =
    Number.isFinite(destinationId) &&
    destinationId > 0 &&
    (itemKind === "income"
      ? itemType !== "tax" && itemType !== "deduction"
      : itemType === "savings" || itemType === "investment");

  if (reversesDestination) {
    await client.query(
      `UPDATE cash_and_investments SET value = COALESCE(value::numeric, 0) - $1 WHERE ci_id = $2`,
      [amount, destinationId],
    );
  }
}

/** Undo tax-page totals, cash balances, and debt principal for one stored transaction. */
export async function reverseStoredTransactionEffects(
  client: DbClient,
  userId: number,
  groupId: number | null,
  row: Record<string, unknown>,
) {
  const debtId = row.debt_id != null ? Number(row.debt_id) : null;
  if (debtId && !isNaN(debtId) && debtId > 0) {
    const principal =
      row.principal_applied != null && Number(row.principal_applied) > 0
        ? Number(row.principal_applied)
        : positiveAmount(row.amount);
    if (principal > 0) await reverseDebtPayment(client, debtId, principal);
  }

  await reverseCashEffects(client, row);

  const txAmount = positiveAmount(row.amount);
  if (!txAmount || !isFromGrossPay(row.from_gross_pay)) return;

  const storedKind = String(row.item_kind || "").toLowerCase();
  const itemKind =
    storedKind === "income" || storedKind === "expense"
      ? storedKind
      : row.income_id != null && Number(row.income_id) > 0
        ? "income"
        : "expense";
  const itemType = String(row.item_type || "").toLowerCase();
  const dateIso = transactionDateIso(row.transaction_date);
  const category = row.category != null ? String(row.category) : null;
  const subCategory = row.sub_category != null ? String(row.sub_category) : null;
  const fiscalYear = yearFromDateString(dateIso);

  if (itemKind === "income" && itemType === "tax") {
    await adjustTaxAnnualTotalForClassification(
      client,
      userId,
      groupId,
      fiscalYear,
      category,
      subCategory,
      -txAmount,
    );
  }

  await applyFiscalTotalsForTransaction(client, userId, groupId, fiscalYear, {
    itemKind,
    itemType,
    category,
    subCategory,
    signedAmount: -txAmount,
  });
}
