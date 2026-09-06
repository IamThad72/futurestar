import { createError } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId, groupAccessClauseAt, soloUserClauseAt } from "../../../utils/group";
import { getActiveBudget } from "../../../utils/budgetAccess";
import { reverseDebtPayment } from "../../../utils/debtPayment";
import { applyFiscalTotalsForTransaction } from "../../../utils/fiscalAnnualTotals";
import { adjustTaxAnnualTotalForClassification, yearFromDateString } from "../../../utils/taxAnnualTotals";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const id = getRouterParam(event, "id");
  if (!id || !/^\d+$/.test(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid transaction ID.",
    });
  }

  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const accessClause = groupId ? groupAccessClauseAt("", 2, 3) : soloUserClauseAt("", 2);
    const params = groupId ? [id, userId, groupId] : [id, userId];

    const result = await client.query(
      `DELETE FROM budget_transactions
       WHERE transaction_id = $1 AND ${accessClause}
       RETURNING transaction_id, debt_id, amount, principal_applied, income_id, transaction_date,
                 item_type, category, sub_category`,
      params,
    );

    if (result.rowCount === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: "Transaction not found.",
      });
    }

    const row = result.rows[0];
    const debtId = row?.debt_id != null ? Number(row.debt_id) : null;
    if (debtId && !isNaN(debtId) && debtId > 0) {
      const principal =
        row.principal_applied != null && Number(row.principal_applied) > 0
          ? Number(row.principal_applied)
          : Number(row.amount) > 0
            ? Number(row.amount)
            : 0;
      await reverseDebtPayment(client, debtId, principal);
    }

    const incomeId = row?.income_id != null ? Number(row.income_id) : null;
    const itemType = String(row?.item_type || "").toLowerCase();
    const dateStr =
      row.transaction_date instanceof Date
        ? row.transaction_date.toISOString().slice(0, 10)
        : String(row.transaction_date || "");
    const category = row?.category != null ? String(row.category) : null;
    const subCategory = row?.sub_category != null ? String(row.sub_category) : null;
    const txAmount = row?.amount != null && !isNaN(Number(row.amount)) ? Math.abs(Number(row.amount)) : 0;
    const fiscalYear = yearFromDateString(dateStr);

    if (txAmount > 0) {
      const active = await getActiveBudget(client, userId, groupId);

      if (incomeId && !isNaN(incomeId) && incomeId > 0 && itemType === "tax") {
        await adjustTaxAnnualTotalForClassification(
          client,
          active.budget_id,
          userId,
          groupId,
          fiscalYear,
          category,
          subCategory,
          -txAmount,
        );
      }

      const itemKind =
        incomeId && !isNaN(incomeId) && incomeId > 0 ? "income" : "expense";
      await applyFiscalTotalsForTransaction(
        client,
        active.budget_id,
        userId,
        groupId,
        fiscalYear,
        {
          itemKind,
          itemType,
          category,
          subCategory,
          signedAmount: -txAmount,
        },
      );
    }

    return { success: true };
  } catch (error) {
    if (error?.statusCode) throw error;
    console.error("Transaction delete failed", error);
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "Failed to delete transaction.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
