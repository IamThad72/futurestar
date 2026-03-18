import { createError, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId } from "../../../utils/group";

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
    if (type === "income") {
      const ownership = await client.query(
        `SELECT COALESCE(income_type, 'gross') as income_type FROM income WHERE income_id = $1 AND user_id = $2`,
        [incomeId, userId],
      );
      if (ownership.rowCount === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: "Invalid income budget item.",
        });
      }
      budgetItemSupportsDestination = (ownership.rows[0]?.income_type ?? "gross") === "gross";
    } else {
      const ownership = await client.query(
        `SELECT COALESCE(expense_type, 'expense') as expense_type FROM expenses WHERE expense_id = $1 AND user_id = $2`,
        [expenseId, userId],
      );
      if (ownership.rowCount === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: "Invalid expense budget item.",
        });
      }
      const expenseType = ownership.rows[0]?.expense_type ?? "expense";
      budgetItemSupportsDestination = expenseType === "savings" || expenseType === "investment";
    }

    const hasCashInvestmentId = cashInvestmentId != null && !isNaN(cashInvestmentId) && cashInvestmentId > 0;
    if (hasCashInvestmentId && !budgetItemSupportsDestination) {
      throw createError({
        statusCode: 400,
        statusMessage:
          type === "income"
            ? "Destination account is only supported for gross pay income."
            : "Destination account is only supported for savings or investment expenses.",
      });
    }

    if (hasCashInvestmentId) {
      const groupId = await getUserGroupId(client, userId);
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

    const effectiveCiId = cashInvestmentId != null && !isNaN(cashInvestmentId) && cashInvestmentId > 0 ? cashInvestmentId : null;
    await client.query(
      `INSERT INTO budget_transactions (user_id, income_id, expense_id, transaction_date, amount, description, cash_investment_id)
       VALUES ($1, $2, $3, $4::date, $5, $6, $7)`,
      [userId, type === "income" ? incomeId : null, type === "expense" ? expenseId : null, dateStr, amount, description || null, effectiveCiId],
    );

    if (effectiveCiId != null && amount != null && !isNaN(amount) && amount > 0) {
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
