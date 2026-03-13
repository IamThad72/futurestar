import { createError, getCookie, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { SESSION_COOKIE_NAME } from "../../../utils/session";

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    throw createError({
      statusCode: 401,
      statusMessage: "You must be logged in to add a transaction.",
    });
  }

  const body = await readBody(event);
  const type = String(body?.type ?? "").trim().toLowerCase();
  const incomeId = body?.income_id != null ? parseInt(String(body.income_id), 10) : null;
  const expenseId = body?.expense_id != null ? parseInt(String(body.expense_id), 10) : null;
  const transactionDate = body?.transaction_date ?? body?.date;
  const amount = body?.amount != null ? Number(body.amount) : null;
  const description = body?.description != null ? String(body.description).trim() : null;

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

    if (type === "income") {
      const ownership = await client.query(
        `SELECT 1 FROM income WHERE income_id = $1 AND user_id = $2`,
        [incomeId, userId],
      );
      if (ownership.rowCount === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: "Invalid income budget item.",
        });
      }
    } else {
      const ownership = await client.query(
        `SELECT 1 FROM expenses WHERE expense_id = $1 AND user_id = $2`,
        [expenseId, userId],
      );
      if (ownership.rowCount === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: "Invalid expense budget item.",
        });
      }
    }

    await client.query(
      `INSERT INTO budget_transactions (user_id, income_id, expense_id, transaction_date, amount, description)
       VALUES ($1, $2, $3, $4::date, $5, $6)`,
      [userId, type === "income" ? incomeId : null, type === "expense" ? expenseId : null, dateStr, amount, description || null],
    );

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
