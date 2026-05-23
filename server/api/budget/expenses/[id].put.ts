import { createError, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId, groupAccessClauseAt, soloUserClauseAt } from "../../../utils/group";
import { budgetExpenseNeedsDebtLink } from "../../../../utils/budgetDebt";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const id = getRouterParam(event, "id");
  if (!id || !/^\d+$/.test(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid budget ID.",
    });
  }

  const body = await readBody(event);
  const expenseType = body?.expense_type != null ? String(body.expense_type).trim().toLowerCase() : null;
  const category = body?.category != null ? String(body.category).trim() : null;
  const subCategory = body?.sub_category != null ? String(body.sub_category).trim() : null;
  const cashInvestmentId = body?.cash_investment_id != null ? parseInt(String(body.cash_investment_id), 10) : null;
  const fromCashInvestmentId =
    body?.from_cash_investment_id !== undefined
      ? body.from_cash_investment_id == null || body.from_cash_investment_id === ""
        ? null
        : parseInt(String(body.from_cash_investment_id), 10)
      : undefined;
  const debtIdProvided = body?.debt_id !== undefined;
  const debtIdParsed = debtIdProvided
    ? body.debt_id == null || body.debt_id === ""
      ? null
      : parseInt(String(body.debt_id), 10)
    : undefined;

  const validExpenseTypes = ["expense", "savings", "investment"];
  if (expenseType !== null && !validExpenseTypes.includes(expenseType)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Expense type must be 'expense', 'savings', or 'investment'.",
    });
  }
  const description = body?.description != null ? String(body.description).trim() : null;
  const monthlyAmount = body?.monthly_amount != null ? Number(body.monthly_amount) : null;
  const annualAmount = body?.annual_amount != null ? Number(body.annual_amount) : null;

  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const readAccessClause = groupId ? groupAccessClauseAt("", 2, 3) : soloUserClauseAt("", 2);
    const readParams = groupId ? [id, userId, groupId] : [id, userId];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (expenseType !== null) {
      updates.push(`expense_type = $${paramIndex++}`);
      values.push(expenseType);
    }
    if (category !== null) {
      updates.push(`expense_category = $${paramIndex++}`);
      values.push(category);
    }
    if (subCategory !== null) {
      updates.push(`sub_category = $${paramIndex++}`);
      values.push(subCategory || null);
    }
    if (description !== null) {
      updates.push(`expense_category_desc = $${paramIndex++}`);
      values.push(description || null);
    }
    if (monthlyAmount !== null) {
      updates.push(`monthly_budget_amt = $${paramIndex++}`);
      values.push(monthlyAmount);
    }
    if (annualAmount !== null) {
      updates.push(`annual_budget_amt = $${paramIndex++}`);
      values.push(annualAmount);
    }
    if (cashInvestmentId !== undefined) {
      const effectiveCiId = cashInvestmentId != null && !isNaN(cashInvestmentId) && cashInvestmentId > 0 ? cashInvestmentId : null;
      updates.push(`cash_investment_id = $${paramIndex++}`);
      values.push(effectiveCiId);
    }
    if (fromCashInvestmentId !== undefined) {
      const effectiveFromId =
        fromCashInvestmentId != null && !isNaN(fromCashInvestmentId) && fromCashInvestmentId > 0 ? fromCashInvestmentId : null;
      updates.push(`from_cash_investment_id = $${paramIndex++}`);
      values.push(effectiveFromId);
    }
    if (debtIdParsed !== undefined) {
      const effectiveDebtId =
        debtIdParsed != null && !isNaN(debtIdParsed) && debtIdParsed > 0 ? debtIdParsed : null;
      updates.push(`debt_id = $${paramIndex++}`);
      values.push(effectiveDebtId);
    }

    if (updates.length === 0) {
      return { success: true };
    }

    const currentRow = await client.query(
      `SELECT expense_type, expense_category, sub_category, expense_category_desc, debt_id
       FROM expenses WHERE expense_id = $1 AND ${readAccessClause}`,
      readParams,
    );
    if (currentRow.rowCount === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: "Budget not found.",
      });
    }
    const row = currentRow.rows[0];
    const mergedExpenseType = expenseType ?? row.expense_type ?? "expense";
    const mergedCategory = category ?? row.expense_category;
    const mergedSub = subCategory !== null ? subCategory : row.sub_category;
    const mergedDesc = description !== null ? description : row.expense_category_desc;
    const mergedDebtId = debtIdParsed !== undefined ? debtIdParsed : row.debt_id;

    if (mergedExpenseType !== "expense" && mergedDebtId != null && !isNaN(mergedDebtId) && mergedDebtId > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "Debt link applies to expense budget lines only.",
      });
    }

    if (
      mergedExpenseType === "expense" &&
      budgetExpenseNeedsDebtLink(mergedCategory, mergedSub, mergedDesc) &&
      (mergedDebtId == null || isNaN(mergedDebtId) || mergedDebtId <= 0)
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: "Select the Estate Management debt record for this expense line.",
      });
    }

    if (mergedDebtId != null && !isNaN(mergedDebtId) && mergedDebtId > 0) {
      const debtCheck = groupId
        ? await client.query(
            `SELECT 1 FROM debt WHERE dbt_id = $1 AND ${groupAccessClauseAt("", 2, 3)}`,
            [mergedDebtId, userId, groupId],
          )
        : await client.query(`SELECT 1 FROM debt WHERE dbt_id = $1 AND user_id = $2`, [mergedDebtId, userId]);
      if (debtCheck.rowCount === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: "Invalid debt record.",
        });
      }
    }

    const idParam = paramIndex++;
    values.push(id);
    const writeAccessClause = groupId
      ? groupAccessClauseAt("", paramIndex, paramIndex + 1)
      : soloUserClauseAt("", paramIndex);
    if (groupId) {
      values.push(userId, groupId);
    } else {
      values.push(userId);
    }

    const result = await client.query(
      `UPDATE expenses SET ${updates.join(", ")} WHERE expense_id = $${idParam} AND ${writeAccessClause} RETURNING expense_id`,
      values,
    );

    if (result.rowCount === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: "Budget not found.",
      });
    }

    return { success: true };
  } catch (error) {
    if (error?.statusCode) throw error;
    console.error("Budget update failed", error);
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "Failed to update budget.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
