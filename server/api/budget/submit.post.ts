import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const body = await readBody(event);
  const type = String(body?.type ?? "").trim().toLowerCase();
  const incomeType = body?.income_type != null ? String(body.income_type).trim().toLowerCase() : "gross";
  const expenseType = body?.expense_type != null ? String(body.expense_type).trim().toLowerCase() : "expense";
  const category = String(body?.category ?? "").trim();
  const subCategory = body?.sub_category != null ? String(body.sub_category).trim() : null;
  const description = body?.description != null ? String(body.description).trim() : null;
  const cashInvestmentId = body?.cash_investment_id != null ? parseInt(String(body.cash_investment_id), 10) : null;
  const monthlyAmount = body?.monthly_amount != null ? Number(body.monthly_amount) : null;
  const annualAmount = body?.annual_amount != null ? Number(body.annual_amount) : null;

  const validIncomeTypes = ["gross", "tax", "deduction", "interest", "other"];
  if (type === "income" && !validIncomeTypes.includes(incomeType)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Income type must be 'gross', 'tax', 'deduction', 'interest', or 'other'.",
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
      const effectiveCiId = cashInvestmentId != null && !isNaN(cashInvestmentId) && cashInvestmentId > 0 ? cashInvestmentId : null;

      if (effectiveCiId != null && (expenseType === "savings" || expenseType === "investment")) {
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

      await client.query(
        `INSERT INTO expenses
          (user_id, expense_type, expense_category, sub_category, expense_category_desc, monthly_budget_amt, annual_budget_amt, cash_investment_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, expenseType, category, subCategory || null, description || null, monthly, annual, effectiveCiId ?? null],
      );
      // Note: Budget plans do not modify actual account balances. Only transactions (via budget/transactions/submit) update cash_and_investments.value.
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
