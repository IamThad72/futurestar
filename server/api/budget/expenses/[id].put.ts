import { createError, getCookie, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { SESSION_COOKIE_NAME } from "../../../utils/session";

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    throw createError({
      statusCode: 401,
      statusMessage: "You must be logged in to update a budget.",
    });
  }

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
    const sessionResult = await client.query(
      `SELECT user_id FROM app_sessions WHERE session_token = $1 AND expires_at > NOW()`,
      [sessionToken],
    );

    const userId = sessionResult.rows[0]?.user_id;
    if (!userId) {
      throw createError({
        statusCode: 401,
        statusMessage: "Session expired. Please log in again.",
      });
    }

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

    if (updates.length === 0) {
      return { success: true };
    }

    values.push(id, userId);
    const result = await client.query(
      `UPDATE expenses SET ${updates.join(", ")} WHERE expense_id = $${paramIndex} AND user_id = $${paramIndex + 1} RETURNING expense_id`,
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
