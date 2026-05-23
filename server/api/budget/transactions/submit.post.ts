import { createError, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId, groupAccessClause, groupAccessClauseAt, soloUserClauseAt } from "../../../utils/group";
import { applyDebtPayment } from "../../../utils/debtPayment";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const body = await readBody(event);
  const type = String(body?.type ?? "").trim().toLowerCase();
  const incomeId = body?.income_id != null ? parseInt(String(body.income_id), 10) : null;
  const expenseId = body?.expense_id != null ? parseInt(String(body.expense_id), 10) : null;
  const transactionDate = body?.transaction_date ?? body?.date;
  const amount = body?.amount != null ? Number(body.amount) : null;
  const description = body?.description != null ? String(body.description).trim() : null;
  const cashInvestmentId = body?.cash_investment_id != null ? parseInt(String(body.cash_investment_id), 10) : null;
  const fromCashInvestmentIdRaw = body?.from_cash_investment_id;
  const fromCashInvestmentIdParsed =
    fromCashInvestmentIdRaw !== undefined && fromCashInvestmentIdRaw !== null && fromCashInvestmentIdRaw !== ""
      ? parseInt(String(fromCashInvestmentIdRaw), 10)
      : null;
  const debtIdRaw = body?.debt_id;
  const debtIdParsed =
    debtIdRaw !== undefined && debtIdRaw !== null && debtIdRaw !== ""
      ? parseInt(String(debtIdRaw), 10)
      : null;
  const incomeSourceIdRaw = body?.income_source_id;
  const incomeSourceIdParsed =
    incomeSourceIdRaw !== undefined && incomeSourceIdRaw !== null && incomeSourceIdRaw !== ""
      ? parseInt(String(incomeSourceIdRaw), 10)
      : null;
  const investmentSourceIdRaw = body?.investment_source_id;
  const investmentSourceIdParsed =
    investmentSourceIdRaw !== undefined && investmentSourceIdRaw !== null && investmentSourceIdRaw !== ""
      ? parseInt(String(investmentSourceIdRaw), 10)
      : null;
  const savingsSourceIdRaw = body?.savings_source_id;
  const savingsSourceIdParsed =
    savingsSourceIdRaw !== undefined && savingsSourceIdRaw !== null && savingsSourceIdRaw !== ""
      ? parseInt(String(savingsSourceIdRaw), 10)
      : null;

  if (type !== "income" && type !== "expense") {
    throw createError({
      statusCode: 400,
      statusMessage: "Type must be 'income' or 'expense'.",
    });
  }

  if (type === "income" && (!incomeId || isNaN(incomeId))) {
    throw createError({
      statusCode: 400,
      statusMessage: "Income budget item is required.",
    });
  }

  if (type === "expense" && (!expenseId || isNaN(expenseId))) {
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

  const client = createDbClient();

  try {
    await client.connect();
    let budgetItemSupportsDestination = false;
    let incomeTypeForAdjust = "gross";
    let expenseTypeForAdjust = "expense";
    const groupId = await getUserGroupId(client, userId);
    const budgetAccessClause = groupId ? groupAccessClauseAt("", 2, 3) : soloUserClauseAt("", 2);
    const budgetAccessParams = groupId ? [userId, groupId] : [userId];

    if (type === "income") {
      const ownership = await client.query(
        `SELECT COALESCE(income_type, 'gross') as income_type FROM income WHERE income_id = $1 AND ${budgetAccessClause}`,
        [incomeId, ...budgetAccessParams],
      );
      if (ownership.rowCount === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: "Invalid income budget item.",
        });
      }
      incomeTypeForAdjust = ownership.rows[0]?.income_type ?? "gross";
      budgetItemSupportsDestination = incomeTypeForAdjust !== "tax" && incomeTypeForAdjust !== "deduction";
    } else {
      const ownership = await client.query(
        `SELECT COALESCE(expense_type, 'expense') as expense_type FROM expenses WHERE expense_id = $1 AND ${budgetAccessClause}`,
        [expenseId, ...budgetAccessParams],
      );
      if (ownership.rowCount === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: "Invalid expense budget item.",
        });
      }
      expenseTypeForAdjust = ownership.rows[0]?.expense_type ?? "expense";
      budgetItemSupportsDestination = true;
    }

    const hasCashInvestmentId = cashInvestmentId != null && !isNaN(cashInvestmentId) && cashInvestmentId > 0;
    const hasDebtId = debtIdParsed != null && !isNaN(debtIdParsed) && debtIdParsed > 0;
    const hasFromCashInvestmentId =
      fromCashInvestmentIdParsed != null && !isNaN(fromCashInvestmentIdParsed) && fromCashInvestmentIdParsed > 0;

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

    const hasIncomeSourceId =
      incomeSourceIdParsed != null && !isNaN(incomeSourceIdParsed) && incomeSourceIdParsed > 0;
    if (type === "income" && hasIncomeSourceId) {
      const srcCheck = groupId
        ? await client.query(
            `SELECT 1 FROM income_sources WHERE source_id = $1 AND ${groupAccessClause()}`,
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

    const hasInvestmentSourceId =
      investmentSourceIdParsed != null && !isNaN(investmentSourceIdParsed) && investmentSourceIdParsed > 0;
    if (type === "expense" && expenseTypeForAdjust === "investment" && hasInvestmentSourceId) {
      const srcCheck = groupId
        ? await client.query(
            `SELECT 1 FROM investment_sources WHERE source_id = $1 AND ${groupAccessClause()}`,
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

    const hasSavingsSourceId =
      savingsSourceIdParsed != null && !isNaN(savingsSourceIdParsed) && savingsSourceIdParsed > 0;
    if (type === "expense" && expenseTypeForAdjust === "savings" && hasSavingsSourceId) {
      const srcCheck = groupId
        ? await client.query(
            `SELECT 1 FROM savings_sources WHERE source_id = $1 AND ${groupAccessClause()}`,
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

    const shouldApplyToDebt =
      type === "expense" &&
      effectiveDebtId != null &&
      amount != null &&
      !isNaN(amount) &&
      amount > 0;

    let principalApplied: number | null = null;
    let interestApplied: number | null = null;

    if (shouldApplyToDebt && effectiveDebtId != null) {
      const applied = await applyDebtPayment(client, effectiveDebtId, amount, userId, groupId);
      principalApplied = applied.principal;
      interestApplied = applied.interest;
    }

    await client.query(
      `INSERT INTO budget_transactions (user_id, group_id, income_id, expense_id, transaction_date, amount, description, cash_investment_id, debt_id, from_cash_investment_id, income_source_id, investment_source_id, savings_source_id, principal_applied, interest_applied)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
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
      ],
    );

    const shouldDecrementFromAccount =
      type === "expense" &&
      effectiveFromCiId != null &&
      amount != null &&
      !isNaN(amount) &&
      amount > 0;

    if (shouldDecrementFromAccount) {
      await client.query(
        `UPDATE cash_and_investments SET value = COALESCE(value::numeric, 0) - $1 WHERE ci_id = $2`,
        [amount, effectiveFromCiId],
      );
    }

    const shouldAdjustCashBalance =
      effectiveCiId != null &&
      amount != null &&
      !isNaN(amount) &&
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

    return { success: true };
  } catch (error) {
    if (error?.statusCode) throw error;
    console.error("Transaction submit failed", error);
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "Failed to add transaction.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
