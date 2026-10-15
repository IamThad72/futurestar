import { createError } from "h3";
import { groupAccessClauseAt } from "./group";
import { resolveRecordingTarget } from "./budgetCategories";
import { applyDebtPayment } from "./debtPayment";
import { applyFiscalTotalsForTransaction } from "./fiscalAnnualTotals";
import { adjustTaxAnnualTotalForClassification, yearFromDateString } from "./taxAnnualTotals";
import { parsePayBatchId } from "./grossPayTransaction";

type DbClient = {
  query: (queryText: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
};

function positiveId(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const id = parseInt(String(value), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Insert one budget actual and, when it belongs to a gross paycheck, add that
 * amount onto the stored tax-page totals. Caller owns the database connection.
 */
export async function recordBudgetTransaction(
  client: DbClient,
  userId: number,
  groupId: number | null,
  body: Record<string, unknown>,
) {
  const type = String(body?.type ?? "").trim().toLowerCase();
  let incomeId = positiveId(body?.income_id);
  let expenseId = positiveId(body?.expense_id);
  const transactionDate = body?.transaction_date ?? body?.date;
  const amount = body?.amount != null ? Number(body.amount) : null;
  const description = body?.description != null ? String(body.description).trim() : null;
  const cashInvestmentId = positiveId(body?.cash_investment_id);
  const fromCashInvestmentIdParsed = positiveId(body?.from_cash_investment_id);
  const debtIdParsed = positiveId(body?.debt_id);
  const debtCharge = body?.debt_charge === true;
  const incomeSourceIdParsed = positiveId(body?.income_source_id);
  const investmentSourceIdParsed = positiveId(body?.investment_source_id);
  const savingsSourceIdParsed = positiveId(body?.savings_source_id);
  const fromGrossPay = body?.from_gross_pay === true;
  const payBatchId = fromGrossPay ? parsePayBatchId(body?.pay_batch_id) : null;

  if (type !== "income" && type !== "expense") {
    throw createError({
      statusCode: 400,
      statusMessage: "Type must be 'income' or 'expense'.",
    });
  }

  const classCategory = body?.category != null ? String(body.category).trim() : "";
  if (type === "income" && !incomeId && !classCategory) {
    throw createError({
      statusCode: 400,
      statusMessage: "Income budget item is required.",
    });
  }

  if (type === "expense" && !expenseId && !classCategory) {
    throw createError({
      statusCode: 400,
      statusMessage: "Expense budget item is required.",
    });
  }

  if (!transactionDate) {
    throw createError({
      statusCode: 400,
      statusMessage: "Transaction date is required.",
    });
  }

  const dateStr = String(transactionDate).trim();
  const parsedDate = new Date(dateStr);
  if (isNaN(parsedDate.getTime())) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid transaction date.",
    });
  }

  if (amount == null || isNaN(amount)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Amount is required.",
    });
  }

  let budgetItemSupportsDestination = false;
  let incomeTypeForAdjust = "gross";
  let expenseTypeForAdjust = "expense";
  let itemKind: "income" | "expense" = type === "income" ? "income" : "expense";
  let itemType = type === "income" ? "gross" : "expense";
  let category = "Uncategorized";
  let subCategory: string | null = null;
  const recorded = await resolveRecordingTarget(client, userId, groupId, {
    kind: type === "income" ? "income" : "expense",
    lineId: type === "income" ? incomeId : expenseId,
    itemType: body?.item_type,
    category: body?.category,
    subCategory: body?.sub_category,
  });
  incomeId = recorded.incomeId;
  expenseId = recorded.expenseId;
  itemKind = recorded.itemKind;
  itemType = recorded.itemType;
  category = recorded.category || "Uncategorized";
  subCategory = recorded.subCategory;
  if (type === "income") {
    incomeTypeForAdjust = itemType || "gross";
    budgetItemSupportsDestination = incomeTypeForAdjust !== "tax" && incomeTypeForAdjust !== "deduction";
  } else {
    expenseTypeForAdjust = itemType || "expense";
    budgetItemSupportsDestination = true;
  }

  const hasCashInvestmentId = cashInvestmentId != null;
  const hasDebtId = debtIdParsed != null;
  const hasFromCashInvestmentId = fromCashInvestmentIdParsed != null;

  if (hasCashInvestmentId && hasDebtId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Provide either a cash account or a debt record, not both.",
    });
  }

  if (type === "income" && hasDebtId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debt institution applies to expense transactions only.",
    });
  }

  if (hasCashInvestmentId && !budgetItemSupportsDestination) {
    throw createError({
      statusCode: 400,
      statusMessage: "Destination account is only supported for income (not tax/deductions).",
    });
  }

  if (hasDebtId && !budgetItemSupportsDestination) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debt institution is not valid for this budget item.",
    });
  }

  if (hasCashInvestmentId) {
    const acctCheck = groupId
      ? await client.query(
          `SELECT 1 FROM cash_and_investments WHERE ci_id = $1 AND (user_id = $2 OR group_id = $3 OR user_id IN (SELECT user_id FROM group_members WHERE group_id = $3))`,
          [cashInvestmentId, userId, groupId],
        )
      : await client.query(`SELECT 1 FROM cash_and_investments WHERE ci_id = $1 AND user_id = $2`, [cashInvestmentId, userId]);
    if (acctCheck.rowCount === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid destination account.",
      });
    }
  }

  if (hasFromCashInvestmentId) {
    const acctCheck = groupId
      ? await client.query(
          `SELECT 1 FROM cash_and_investments WHERE ci_id = $1 AND (user_id = $2 OR group_id = $3 OR user_id IN (SELECT user_id FROM group_members WHERE group_id = $3))`,
          [fromCashInvestmentIdParsed, userId, groupId],
        )
      : await client.query(`SELECT 1 FROM cash_and_investments WHERE ci_id = $1 AND user_id = $2`, [fromCashInvestmentIdParsed, userId]);
    if (acctCheck.rowCount === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid source account.",
      });
    }
  }

  if (hasDebtId) {
    const debtCheck = groupId
      ? await client.query(
          `SELECT 1 FROM debt WHERE dbt_id = $1 AND (user_id = $2 OR group_id = $3 OR user_id IN (SELECT user_id FROM group_members WHERE group_id = $3))`,
          [debtIdParsed, userId, groupId],
        )
      : await client.query(`SELECT 1 FROM debt WHERE dbt_id = $1 AND user_id = $2`, [debtIdParsed, userId]);
    if (debtCheck.rowCount === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid debt institution.",
      });
    }
  }

  const hasIncomeSourceId = incomeSourceIdParsed != null;
  if (type === "income" && hasIncomeSourceId) {
    const srcCheck = groupId
      ? await client.query(
          `SELECT 1 FROM income_sources WHERE source_id = $1 AND ${groupAccessClauseAt("", 2, 3)}`,
          [incomeSourceIdParsed, userId, groupId],
        )
      : await client.query(`SELECT 1 FROM income_sources WHERE source_id = $1 AND user_id = $2`, [incomeSourceIdParsed, userId]);
    if (srcCheck.rowCount === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid income source.",
      });
    }
  }

  const hasInvestmentSourceId = investmentSourceIdParsed != null;
  if (type === "expense" && expenseTypeForAdjust === "investment" && hasInvestmentSourceId) {
    const srcCheck = groupId
      ? await client.query(
          `SELECT 1 FROM investment_sources WHERE source_id = $1 AND ${groupAccessClauseAt("", 2, 3)}`,
          [investmentSourceIdParsed, userId, groupId],
        )
      : await client.query(`SELECT 1 FROM investment_sources WHERE source_id = $1 AND user_id = $2`, [investmentSourceIdParsed, userId]);
    if (srcCheck.rowCount === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid investment source.",
      });
    }
  }

  const hasSavingsSourceId = savingsSourceIdParsed != null;
  if (type === "expense" && expenseTypeForAdjust === "savings" && hasSavingsSourceId) {
    const srcCheck = groupId
      ? await client.query(
          `SELECT 1 FROM savings_sources WHERE source_id = $1 AND ${groupAccessClauseAt("", 2, 3)}`,
          [savingsSourceIdParsed, userId, groupId],
        )
      : await client.query(`SELECT 1 FROM savings_sources WHERE source_id = $1 AND user_id = $2`, [savingsSourceIdParsed, userId]);
    if (srcCheck.rowCount === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid savings source.",
      });
    }
  }

  const effectiveCiId = hasCashInvestmentId ? cashInvestmentId : null;
  const effectiveDebtId = hasDebtId ? debtIdParsed : null;
  const effectiveFromCiId =
    type === "expense" && (expenseTypeForAdjust === "savings" || expenseTypeForAdjust === "investment")
      ? null
      : hasFromCashInvestmentId
        ? fromCashInvestmentIdParsed
        : null;
  const effectiveIncomeSourceId = type === "income" && hasIncomeSourceId ? incomeSourceIdParsed : null;
  const effectiveInvestmentSourceId =
    type === "expense" && expenseTypeForAdjust === "investment" && hasInvestmentSourceId ? investmentSourceIdParsed : null;
  const effectiveSavingsSourceId =
    type === "expense" && expenseTypeForAdjust === "savings" && hasSavingsSourceId ? savingsSourceIdParsed : null;

  const shouldApplyToDebt = type === "expense" && effectiveDebtId != null && amount > 0 && !debtCharge;

  let principalApplied: number | null = null;
  let interestApplied: number | null = null;

  if (shouldApplyToDebt && effectiveDebtId != null) {
    const applied = await applyDebtPayment(client, effectiveDebtId, amount, userId, groupId);
    principalApplied = applied.principal;
    interestApplied = applied.interest;
  }

  if (debtCharge && type === "expense" && effectiveDebtId != null && amount > 0) {
    await client.query(
      `UPDATE debt SET loan_ammount = COALESCE(loan_ammount::numeric, 0) + $1 WHERE dbt_id = $2`,
      [amount, effectiveDebtId],
    );
  }

  await client.query(
    `INSERT INTO budget_transactions (
       user_id, group_id, income_id, expense_id, transaction_date, amount, description,
       cash_investment_id, debt_id, from_cash_investment_id, income_source_id, investment_source_id,
       savings_source_id, principal_applied, interest_applied,
       item_kind, item_type, category, sub_category, from_gross_pay, pay_batch_id
     )
     VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
    [
      userId,
      groupId ?? null,
      type === "income" ? incomeId : null,
      type === "expense" ? expenseId : null,
      dateStr,
      amount,
      description || null,
      effectiveCiId,
      effectiveDebtId,
      effectiveFromCiId,
      effectiveIncomeSourceId,
      effectiveInvestmentSourceId,
      effectiveSavingsSourceId,
      principalApplied,
      interestApplied,
      itemKind,
      itemType,
      category,
      subCategory,
      fromGrossPay,
      payBatchId,
    ],
  );

  const shouldDecrementFromAccount = type === "expense" && effectiveFromCiId != null && amount > 0;

  if (shouldDecrementFromAccount) {
    await client.query(
      `UPDATE cash_and_investments SET value = COALESCE(value::numeric, 0) - $1 WHERE ci_id = $2`,
      [amount, effectiveFromCiId],
    );
  }

  const shouldAdjustCashBalance =
    effectiveCiId != null &&
    amount > 0 &&
    (type === "income"
      ? incomeTypeForAdjust !== "tax" && incomeTypeForAdjust !== "deduction"
      : expenseTypeForAdjust === "savings" || expenseTypeForAdjust === "investment");

  if (shouldAdjustCashBalance) {
    await client.query(
      `UPDATE cash_and_investments SET value = COALESCE(value::numeric, 0) + $1 WHERE ci_id = $2`,
      [amount, effectiveCiId],
    );
  }

  const txAmount = Math.abs(amount);
  const fiscalYear = yearFromDateString(dateStr);
  if (fromGrossPay && txAmount > 0) {
    if (type === "income" && incomeTypeForAdjust === "tax") {
      await adjustTaxAnnualTotalForClassification(
        client,
        userId,
        groupId,
        fiscalYear,
        category,
        subCategory,
        txAmount,
      );
    }

    await applyFiscalTotalsForTransaction(client, userId, groupId, fiscalYear, {
      itemKind: type === "income" ? "income" : "expense",
      itemType: type === "income" ? incomeTypeForAdjust : expenseTypeForAdjust,
      category,
      subCategory,
      signedAmount: txAmount,
    });
  }
}
