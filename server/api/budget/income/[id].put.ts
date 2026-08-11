import { createError, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId, groupAccessClauseAt, soloUserClauseAt } from "../../../utils/group";
import { resolveBudgetId } from "../../../utils/budgetAccess";

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
  const incomeType = body?.income_type != null ? String(body.income_type).trim().toLowerCase() : null;
  const category = body?.category != null ? String(body.category).trim() : null;
  const subCategory = body?.sub_category != null ? String(body.sub_category).trim() : null;
  const description = body?.description != null ? String(body.description).trim() : null;
  const monthlyAmount = body?.monthly_amount != null ? Number(body.monthly_amount) : null;
  const annualAmount = body?.annual_amount != null ? Number(body.annual_amount) : null;
  const cashInvestmentIdRaw = body?.cash_investment_id;
  const cashInvestmentProvided = cashInvestmentIdRaw !== undefined;
  const cashInvestmentId =
    cashInvestmentIdRaw === null || cashInvestmentIdRaw === ""
      ? null
      : cashInvestmentIdRaw != null
        ? parseInt(String(cashInvestmentIdRaw), 10)
        : null;

  const validIncomeTypes = ["gross", "tax", "deduction", "interest", "other"];
  if (incomeType !== null && !validIncomeTypes.includes(incomeType)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Income type must be 'gross', 'tax', 'deduction', 'interest', or 'other'.",
    });
  }

  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const budget = await resolveBudgetId(client, userId, groupId, body?.budget_id);

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (incomeType !== null) {
      updates.push(`income_type = $${paramIndex++}`);
      values.push(incomeType);
    }
    if (category !== null) {
      updates.push(`income_category = $${paramIndex++}`);
      values.push(category);
    }
    if (subCategory !== null) {
      updates.push(`sub_category = $${paramIndex++}`);
      values.push(subCategory || null);
    }
    if (description !== null) {
      updates.push(`income_category_desc = $${paramIndex++}`);
      values.push(description || null);
    }
    if (monthlyAmount !== null) {
      updates.push(`income_category_monthly_amt = $${paramIndex++}`);
      values.push(monthlyAmount);
    }
    if (annualAmount !== null) {
      updates.push(`income_category_annual_amt = $${paramIndex++}`);
      values.push(annualAmount);
    }
    if (cashInvestmentProvided) {
      updates.push(`cash_investment_id = $${paramIndex++}`);
      values.push(
        cashInvestmentId != null && !isNaN(cashInvestmentId) && cashInvestmentId > 0 ? cashInvestmentId : null,
      );
    }

    if (updates.length === 0) {
      return { success: true };
    }

    const idParam = paramIndex++;
    values.push(id);
    const accessClause = groupId
      ? groupAccessClauseAt("", paramIndex, paramIndex + 1)
      : soloUserClauseAt("", paramIndex);
    if (groupId) {
      values.push(userId, groupId);
      paramIndex += 2;
    } else {
      values.push(userId);
      paramIndex += 1;
    }
    const budgetParam = paramIndex++;
    values.push(budget.budget_id);

    const result = await client.query(
      `UPDATE income SET ${updates.join(", ")}
       WHERE income_id = $${idParam} AND ${accessClause} AND budget_id = $${budgetParam}
       RETURNING income_id, income_type`,
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
