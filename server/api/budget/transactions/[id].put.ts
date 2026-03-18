import { createError, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId } from "../../../utils/group";

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

    let setClause = "transaction_date = $1::date, amount = $2, description = $3";
    const params = [dateStr, amount, description || null];
    let paramIndex = 4;

    if (incomeId != null && expenseId == null) {
      const checkIncome = await client.query(
        "SELECT 1 FROM income WHERE income_id = $1 AND user_id = $2",
        [incomeId, userId],
      );
      if (checkIncome.rowCount === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: "Invalid income budget item.",
        });
      }
      setClause += `, income_id = $${paramIndex}, expense_id = NULL`;
      params.push(incomeId);
      paramIndex++;
    } else if (expenseId != null && incomeId == null) {
      const checkExpense = await client.query(
        "SELECT 1 FROM expenses WHERE expense_id = $1 AND user_id = $2",
        [expenseId, userId],
      );
      if (checkExpense.rowCount === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: "Invalid expense budget item.",
        });
      }
      setClause += `, income_id = NULL, expense_id = $${paramIndex}`;
      params.push(expenseId);
      paramIndex++;
    } else if (incomeId != null && expenseId != null) {
      throw createError({
        statusCode: 400,
        statusMessage: "Provide either income_id or expense_id, not both.",
      });
    }

    if (cashInvestmentId !== undefined) {
      const effectiveCiId = cashInvestmentId == null || isNaN(cashInvestmentId) || cashInvestmentId <= 0 ? null : cashInvestmentId;
      if (effectiveCiId != null) {
        const groupId = await getUserGroupId(client, userId);
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
      setClause += `, cash_investment_id = $${paramIndex}`;
      params.push(effectiveCiId);
      paramIndex++;
    }

    params.push(id, userId);
    const result = await client.query(
      `UPDATE budget_transactions
       SET ${setClause}
       WHERE transaction_id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING transaction_id`,
      params,
    );

    if (result.rowCount === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: "Transaction not found.",
      });
    }

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
