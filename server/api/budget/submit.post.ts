import { createError, getCookie, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { SESSION_COOKIE_NAME } from "../../utils/session";

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    throw createError({
      statusCode: 401,
      statusMessage: "You must be logged in to create a budget.",
    });
  }

  const body = await readBody(event);
  const type = String(body?.type ?? "").trim().toLowerCase();
  const incomeType = body?.income_type != null ? String(body.income_type).trim().toLowerCase() : "gross";
  const expenseType = body?.expense_type != null ? String(body.expense_type).trim().toLowerCase() : "expense";
  const category = String(body?.category ?? "").trim();
  const subCategory = body?.sub_category != null ? String(body.sub_category).trim() : null;
  const description = body?.description != null ? String(body.description).trim() : null;
  const monthlyAmount = body?.monthly_amount != null ? Number(body.monthly_amount) : null;
  const annualAmount = body?.annual_amount != null ? Number(body.annual_amount) : null;

  const validIncomeTypes = ["gross", "tax", "deduction"];
  if (type === "income" && !validIncomeTypes.includes(incomeType)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Income type must be 'gross', 'tax', or 'deduction'.",
    });
  }

  const validExpenseTypes = ["expense", "savings", "investment"];
  if (type === "expense" && !validExpenseTypes.includes(expenseType)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Expense type must be 'expense', 'savings', or 'investment'.",
    });
  }

  if (type !== "income" && type !== "expense") {
    throw createError({
      statusCode: 400,
      statusMessage: "Type must be 'income' or 'expense'.",
    });
  }

  if (!category) {
    throw createError({
      statusCode: 400,
      statusMessage: "Category is required.",
    });
  }

  const client = createDbClient();

  try {
    await client.connect();
    const sessionResult = await client.query(
      `SELECT user_id
       FROM app_sessions
       WHERE session_token = $1 AND expires_at > NOW()`,
      [sessionToken],
    );

    const userId = sessionResult.rows[0]?.user_id;

    if (!userId) {
      throw createError({
        statusCode: 401,
        statusMessage: "Session expired. Please log in again.",
      });
    }

    const monthly = monthlyAmount ?? (annualAmount != null ? annualAmount / 12 : null);
    const annual = annualAmount ?? (monthlyAmount != null ? monthlyAmount * 12 : null);

    if (type === "income") {
      await client.query(
        `INSERT INTO income
          (user_id, income_type, income_category, sub_category, income_category_desc, income_category_monthly_amt, income_category_annual_amt)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, incomeType, category, subCategory || null, description || null, monthly, annual],
      );
    } else {
      await client.query(
        `INSERT INTO expenses
          (user_id, expense_type, expense_category, sub_category, expense_category_desc, monthly_budget_amt, annual_budget_amt)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, expenseType, category, subCategory || null, description || null, monthly, annual],
      );
    }

    return { success: true };
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    console.error("Budget submit failed", error);
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "Failed to create budget.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
