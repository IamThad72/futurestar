import { createError, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId, groupAccessClause, groupAccessClauseAt, soloUserClauseAt } from "../../../utils/group";
import { getBudgetForPeriod } from "../../../utils/budgetAccess";
import { applyDebtPayment, reverseDebtPayment } from "../../../utils/debtPayment";
import { applyFiscalTotalsForTransaction } from "../../../utils/fiscalAnnualTotals";
import { adjustTaxAnnualTotalForClassification, yearFromDateString } from "../../../utils/taxAnnualTotals";

function principalToRestore(row: Record<string, unknown>): number {
  const debtId = row.debt_id != null ? Number(row.debt_id) : null;
  if (!debtId || isNaN(debtId) || debtId <= 0) return 0;
  if (row.principal_applied != null && Number(row.principal_applied) > 0) {
    return Number(row.principal_applied);
  }
  const amt = Number(row.amount);
  return amt > 0 && !isNaN(amt) ? amt : 0;
}

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const id = getRouterParam(event, "id");
  if (!id || !/^\d+$/.test(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid transaction ID.",
    });
  }

  const body = await readBody(event);
  const transactionDate = body?.transaction_date ?? body?.date;
  const amount = body?.amount != null ? Number(body.amount) : null;
  const description = body?.description != null ? String(body.description).trim() : null;
  const incomeId = body?.income_id != null ? (Number(body.income_id) || null) : undefined;
  const expenseId = body?.expense_id != null ? (Number(body.expense_id) || null) : undefined;
  const cashInvestmentIdRaw = body?.cash_investment_id;
  const cashInvestmentId = cashInvestmentIdRaw === undefined ? undefined : (cashInvestmentIdRaw == null || cashInvestmentIdRaw === "" ? null : parseInt(String(cashInvestmentIdRaw), 10));
  const fromCashInvestmentIdRaw = body?.from_cash_investment_id;
  const fromCashInvestmentIdFromBody = fromCashInvestmentIdRaw === undefined ? undefined : (fromCashInvestmentIdRaw == null || fromCashInvestmentIdRaw === "" ? null : parseInt(String(fromCashInvestmentIdRaw), 10));
  const debtIdRaw = body?.debt_id;
  const debtIdFromBody = debtIdRaw === undefined ? undefined : (debtIdRaw == null || debtIdRaw === "" ? null : parseInt(String(debtIdRaw), 10));

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
    const groupId = await getUserGroupId(client, userId);
    const accessClause = groupId ? groupAccessClauseAt("", 2, 3) : soloUserClauseAt("", 2);
    const accessParams = groupId ? [id, userId, groupId] : [id, userId];
    const budgetAccessClause = groupId ? groupAccessClauseAt("", 2, 3) : soloUserClauseAt("", 2);
    const budgetAccessParams = groupId ? [userId, groupId] : [userId];

    const existingRes = await client.query(
      `SELECT debt_id, amount, principal_applied, expense_id, income_id, transaction_date,
              item_type, category, sub_category
       FROM budget_transactions WHERE transaction_id = $1 AND ${accessClause}`,
      accessParams,
    );
    if (existingRes.rowCount === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: "Transaction not found.",
      });
    }
    const oldRow = existingRes.rows[0] as Record<string, unknown>;
    const oldDebtId = oldRow.debt_id != null ? Number(oldRow.debt_id) : null;
    const oldPrincipal = principalToRestore(oldRow);

    let finalDebtId = oldDebtId != null && !isNaN(oldDebtId) && oldDebtId > 0 ? oldDebtId : null;
    let finalExpenseId = oldRow.expense_id != null ? Number(oldRow.expense_id) : null;
    let finalIncomeId = oldRow.income_id != null ? Number(oldRow.income_id) : null;
    let finalItemType = oldRow.item_type != null ? String(oldRow.item_type) : null;
    let finalCategory = oldRow.category != null ? String(oldRow.category) : null;
    let finalSubCategory = oldRow.sub_category != null ? String(oldRow.sub_category) : null;

    let setClause = "transaction_date = $1::date, amount = $2, description = $3";
    const params: unknown[] = [dateStr, amount, description || null];
    let paramIndex = 4;

    if (incomeId != null && expenseId == null) {
      const checkIncome = await client.query(
        `SELECT COALESCE(income_type, 'gross') as item_type, income_category as category, sub_category
         FROM income WHERE income_id = $1 AND ${budgetAccessClause}`,
        [incomeId, ...budgetAccessParams],
      );
      if (checkIncome.rowCount === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: "Invalid income budget item.",
        });
      }
      const row = checkIncome.rows[0];
      setClause += `, income_id = $${paramIndex}, expense_id = NULL, item_kind = 'income', item_type = $${paramIndex + 1}, category = $${paramIndex + 2}, sub_category = $${paramIndex + 3}`;
      params.push(incomeId, row.item_type, row.category || "Uncategorized", row.sub_category ?? null);
      paramIndex += 4;
      finalIncomeId = incomeId;
      finalExpenseId = null;
      finalDebtId = null;
      finalItemType = row.item_type != null ? String(row.item_type) : null;
      finalCategory = row.category != null ? String(row.category || "Uncategorized") : "Uncategorized";
      finalSubCategory = row.sub_category != null ? String(row.sub_category) : null;
    } else if (expenseId != null && incomeId == null) {
      const checkExpense = await client.query(
        `SELECT COALESCE(expense_type, 'expense') as item_type, expense_category as category, sub_category
         FROM expenses WHERE expense_id = $1 AND ${budgetAccessClause}`,
        [expenseId, ...budgetAccessParams],
      );
      if (checkExpense.rowCount === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: "Invalid expense budget item.",
        });
      }
      const row = checkExpense.rows[0];
      setClause += `, income_id = NULL, expense_id = $${paramIndex}, item_kind = 'expense', item_type = $${paramIndex + 1}, category = $${paramIndex + 2}, sub_category = $${paramIndex + 3}`;
      params.push(expenseId, row.item_type, row.category || "Uncategorized", row.sub_category ?? null);
      paramIndex += 4;
      finalExpenseId = expenseId;
      finalIncomeId = null;
      finalItemType = row.item_type != null ? String(row.item_type) : null;
      finalCategory = row.category != null ? String(row.category || "Uncategorized") : "Uncategorized";
      finalSubCategory = row.sub_category != null ? String(row.sub_category) : null;
    } else if (incomeId != null && expenseId != null) {
      throw createError({
        statusCode: 400,
        statusMessage: "Provide either income_id or expense_id, not both.",
      });
    }

    if (fromCashInvestmentIdFromBody !== undefined) {
      const effectiveFromId =
        fromCashInvestmentIdFromBody == null || isNaN(fromCashInvestmentIdFromBody) || fromCashInvestmentIdFromBody <= 0
          ? null
          : fromCashInvestmentIdFromBody;
      if (effectiveFromId != null) {
        const acctCheck = groupId
          ? await client.query(
              `SELECT 1 FROM cash_and_investments WHERE ci_id = $1 AND (user_id = $2 OR group_id = $3 OR user_id IN (SELECT user_id FROM group_members WHERE group_id = $3))`,
              [effectiveFromId, userId, groupId],
            )
          : await client.query(`SELECT 1 FROM cash_and_investments WHERE ci_id = $1 AND user_id = $2`, [effectiveFromId, userId]);
        if (acctCheck.rowCount === 0) {
          throw createError({
            statusCode: 400,
            statusMessage: "Invalid source account.",
          });
        }
      }
      setClause += `, from_cash_investment_id = $${paramIndex}`;
      params.push(effectiveFromId);
      paramIndex++;
    }

    const cashProvided = cashInvestmentId !== undefined;
    const debtProvided = debtIdFromBody !== undefined;

    if (cashProvided && debtProvided) {
      const effectiveCiId =
        cashInvestmentId != null && !isNaN(cashInvestmentId) && cashInvestmentId > 0 ? cashInvestmentId : null;
      const effectiveDebtId =
        debtIdFromBody != null && !isNaN(debtIdFromBody) && debtIdFromBody > 0 ? debtIdFromBody : null;
      if (effectiveCiId != null && effectiveDebtId != null) {
        throw createError({
          statusCode: 400,
          statusMessage: "Provide either a cash account or a debt record, not both.",
        });
      }
      if (effectiveCiId != null) {
        const acctCheck = groupId
          ? await client.query(
              `SELECT 1 FROM cash_and_investments WHERE ci_id = $1 AND (user_id = $2 OR group_id = $3 OR user_id IN (SELECT user_id FROM group_members WHERE group_id = $3))`,
              [effectiveCiId, userId, groupId],
            )
          : await client.query(`SELECT 1 FROM cash_and_investments WHERE ci_id = $1 AND user_id = $2`, [effectiveCiId, userId]);
        if (acctCheck.rowCount === 0) {
          throw createError({
            statusCode: 400,
            statusMessage: "Invalid destination account.",
          });
        }
      }
      if (effectiveDebtId != null) {
        const debtCheck = groupId
          ? await client.query(
              `SELECT 1 FROM debt WHERE dbt_id = $1 AND (user_id = $2 OR group_id = $3 OR user_id IN (SELECT user_id FROM group_members WHERE group_id = $3))`,
              [effectiveDebtId, userId, groupId],
            )
          : await client.query(`SELECT 1 FROM debt WHERE dbt_id = $1 AND user_id = $2`, [effectiveDebtId, userId]);
        if (debtCheck.rowCount === 0) {
          throw createError({
            statusCode: 400,
            statusMessage: "Invalid debt institution.",
          });
        }
      }
      const finalCi = effectiveDebtId != null ? null : effectiveCiId;
      const finalD = effectiveCiId != null ? null : effectiveDebtId;
      setClause += `, cash_investment_id = $${paramIndex}, debt_id = $${paramIndex + 1}`;
      params.push(finalCi, finalD);
      paramIndex += 2;
      finalDebtId = finalD;
    } else if (cashProvided) {
      const effectiveCiId = cashInvestmentId == null || isNaN(cashInvestmentId) || cashInvestmentId <= 0 ? null : cashInvestmentId;
      if (effectiveCiId != null) {
        const acctCheck = groupId
          ? await client.query(
              `SELECT 1 FROM cash_and_investments WHERE ci_id = $1 AND (user_id = $2 OR group_id = $3 OR user_id IN (SELECT user_id FROM group_members WHERE group_id = $3))`,
              [effectiveCiId, userId, groupId],
            )
          : await client.query(`SELECT 1 FROM cash_and_investments WHERE ci_id = $1 AND user_id = $2`, [effectiveCiId, userId]);
        if (acctCheck.rowCount === 0) {
          throw createError({
            statusCode: 400,
            statusMessage: "Invalid destination account.",
          });
        }
        setClause += `, cash_investment_id = $${paramIndex}, debt_id = NULL`;
        params.push(effectiveCiId);
        paramIndex++;
        finalDebtId = null;
      } else {
        setClause += `, cash_investment_id = $${paramIndex}`;
        params.push(null);
        paramIndex++;
      }
    } else if (debtProvided) {
      const effectiveDebtId = debtIdFromBody == null || isNaN(debtIdFromBody) || debtIdFromBody <= 0 ? null : debtIdFromBody;
      if (effectiveDebtId != null) {
        const debtCheck = groupId
          ? await client.query(
              `SELECT 1 FROM debt WHERE dbt_id = $1 AND (user_id = $2 OR group_id = $3 OR user_id IN (SELECT user_id FROM group_members WHERE group_id = $3))`,
              [effectiveDebtId, userId, groupId],
            )
          : await client.query(`SELECT 1 FROM debt WHERE dbt_id = $1 AND user_id = $2`, [effectiveDebtId, userId]);
        if (debtCheck.rowCount === 0) {
          throw createError({
            statusCode: 400,
            statusMessage: "Invalid debt institution.",
          });
        }
        setClause += `, debt_id = $${paramIndex}, cash_investment_id = NULL`;
        params.push(effectiveDebtId);
        paramIndex++;
        finalDebtId = effectiveDebtId;
      } else {
        setClause += `, debt_id = $${paramIndex}`;
        params.push(null);
        paramIndex++;
        finalDebtId = null;
      }
    }

    if (oldDebtId && !isNaN(oldDebtId) && oldDebtId > 0 && oldPrincipal > 0) {
      await reverseDebtPayment(client, oldDebtId, oldPrincipal);
    }

    let principalApplied: number | null = null;
    let interestApplied: number | null = null;
    const isExpense = finalExpenseId != null && finalIncomeId == null;
    if (isExpense && finalDebtId != null && amount > 0) {
      const applied = await applyDebtPayment(client, finalDebtId, amount, userId, groupId);
      principalApplied = applied.principal;
      interestApplied = applied.interest;
    }

    setClause += `, principal_applied = $${paramIndex}, interest_applied = $${paramIndex + 1}`;
    params.push(principalApplied, interestApplied);
    paramIndex += 2;

    const idParam = paramIndex++;
    params.push(id);
    const writeAccessClause = groupId
      ? groupAccessClauseAt("", paramIndex, paramIndex + 1)
      : soloUserClauseAt("", paramIndex);
    if (groupId) {
      params.push(userId, groupId);
    } else {
      params.push(userId);
    }

    const result = await client.query(
      `UPDATE budget_transactions
       SET ${setClause}
       WHERE transaction_id = $${idParam} AND ${writeAccessClause}
       RETURNING transaction_id`,
      params,
    );

    if (result.rowCount === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: "Transaction not found.",
      });
    }

    const oldItemType = String(oldRow.item_type || "").toLowerCase();
    const newItemType = String(finalItemType || "").toLowerCase();
    const oldWasTax = oldItemType === "tax";
    const newIsTax = newItemType === "tax";
    const oldDate =
      oldRow.transaction_date instanceof Date
        ? oldRow.transaction_date.toISOString().slice(0, 10)
        : String(oldRow.transaction_date || "");
    const oldAmount =
      oldRow.amount != null && !isNaN(Number(oldRow.amount)) ? Math.abs(Number(oldRow.amount)) : 0;
    const newAmount = amount != null && !isNaN(amount) ? Math.abs(amount) : 0;
    const oldCategory = oldRow.category != null ? String(oldRow.category) : null;
    const oldSubCategory = oldRow.sub_category != null ? String(oldRow.sub_category) : null;
    const oldItemKind =
      oldRow.income_id != null && Number(oldRow.income_id) > 0 ? "income" : "expense";
    const newItemKind = finalIncomeId != null && finalIncomeId > 0 ? "income" : "expense";

    const oldMatch = /^(\d{4})-(\d{2})/.exec(oldDate);
    const oldYear = oldMatch ? Number(oldMatch[1]) : new Date(oldDate).getFullYear();
    const oldMonth = oldMatch ? Number(oldMatch[2]) : new Date(oldDate).getMonth() + 1;
    const { budget: oldBudget } = await getBudgetForPeriod(client, userId, groupId, oldYear, oldMonth);

    const newMatch = /^(\d{4})-(\d{2})/.exec(dateStr);
    const newYear = newMatch ? Number(newMatch[1]) : new Date(dateStr).getFullYear();
    const newMonth = newMatch ? Number(newMatch[2]) : new Date(dateStr).getMonth() + 1;
    const { budget: newBudget } = await getBudgetForPeriod(client, userId, groupId, newYear, newMonth);

    if (oldWasTax) {
      await adjustTaxAnnualTotalForClassification(
        client,
        oldBudget.budget_id,
        userId,
        groupId,
        yearFromDateString(oldDate),
        oldCategory,
        oldSubCategory,
        -oldAmount,
      );
    }
    if (newIsTax) {
      await adjustTaxAnnualTotalForClassification(
        client,
        newBudget.budget_id,
        userId,
        groupId,
        yearFromDateString(dateStr),
        finalCategory,
        finalSubCategory,
        newAmount,
      );
    }

    await applyFiscalTotalsForTransaction(
      client,
      oldBudget.budget_id,
      userId,
      groupId,
      yearFromDateString(oldDate),
      {
        itemKind: oldItemKind,
        itemType: oldItemType,
        category: oldCategory,
        subCategory: oldSubCategory,
        signedAmount: -oldAmount,
      },
    );
    await applyFiscalTotalsForTransaction(
      client,
      newBudget.budget_id,
      userId,
      groupId,
      yearFromDateString(dateStr),
      {
        itemKind: newItemKind,
        itemType: newItemType,
        category: finalCategory,
        subCategory: finalSubCategory,
        signedAmount: newAmount,
      },
    );

    return { success: true };
  } catch (error) {
    if (error?.statusCode) throw error;
    console.error("Transaction update failed", error);
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "Failed to update transaction.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
