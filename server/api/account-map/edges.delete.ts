import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId, groupAccessClauseAt, soloUserClauseAt } from "../../utils/group";
import { resolveBudgetId } from "../../utils/budgetAccess";
import { parseNodeKey } from "../../utils/accountMap";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const body = await readBody(event);
  const edgeId = String(body?.id ?? "");
  const persistence = String(body?.persistence ?? "");

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const budget = await resolveBudgetId(client, userId, groupId, body?.budget_id);

    if (edgeId.startsWith("ff:") || persistence === "freeform") {
      const ffId = body?.freeform_edge_id != null
        ? Number(body.freeform_edge_id)
        : Number(edgeId.replace(/^ff:/, ""));
      if (!Number.isFinite(ffId) || ffId <= 0) {
        throw createError({ statusCode: 400, statusMessage: "Invalid freeform edge id." });
      }
      const result = await client.query(
        `DELETE FROM account_map_edges WHERE edge_id = $1 AND budget_id = $2`,
        [ffId, budget.budget_id],
      );
      if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: "Edge not found." });
      return { success: true };
    }

    if (persistence === "debt_link" || edgeId.startsWith("fk:debt_link:")) {
      const debtId = Number(body?.source_id ?? edgeId.replace(/^fk:debt_link:/, ""));
      if (!Number.isFinite(debtId)) throw createError({ statusCode: 400, statusMessage: "Invalid debt id." });
      const access = groupId ? groupAccessClauseAt("", 2, 3) : soloUserClauseAt("", 2);
      const params = groupId ? [debtId, userId, groupId] : [debtId, userId];
      await client.query(
        `UPDATE debt SET linked_asset_type = NULL, linked_asset_id = NULL WHERE dbt_id = $1 AND ${access}`,
        params,
      );
      return { success: true };
    }

    if (persistence === "income_deposit" || edgeId.startsWith("fk:income_deposit:")) {
      const incomeId = Number(body?.source_id ?? edgeId.replace(/^fk:income_deposit:/, ""));
      const access = groupId ? groupAccessClauseAt("", 2, 3) : soloUserClauseAt("", 2);
      const budgetParam = groupId ? "$4" : "$3";
      const params = groupId
        ? [incomeId, userId, groupId, budget.budget_id]
        : [incomeId, userId, budget.budget_id];
      await client.query(
        `UPDATE income SET cash_investment_id = NULL
         WHERE income_id = $1 AND ${access} AND budget_id = ${budgetParam}`,
        params,
      );
      return { success: true };
    }

    if (persistence === "expense_destination" || edgeId.startsWith("fk:expense_destination:")) {
      const expenseId = Number(body?.source_id ?? edgeId.replace(/^fk:expense_destination:/, ""));
      const access = groupId ? groupAccessClauseAt("", 2, 3) : soloUserClauseAt("", 2);
      const budgetParam = groupId ? "$4" : "$3";
      const params = groupId
        ? [expenseId, userId, groupId, budget.budget_id]
        : [expenseId, userId, budget.budget_id];
      await client.query(
        `UPDATE expenses SET cash_investment_id = NULL
         WHERE expense_id = $1 AND ${access} AND budget_id = ${budgetParam}`,
        params,
      );
      return { success: true };
    }

    if (persistence === "expense_source" || edgeId.startsWith("fk:expense_source:")) {
      const expenseId = Number(body?.target_id ?? edgeId.replace(/^fk:expense_source:/, ""));
      const access = groupId ? groupAccessClauseAt("", 2, 3) : soloUserClauseAt("", 2);
      const budgetParam = groupId ? "$4" : "$3";
      const params = groupId
        ? [expenseId, userId, groupId, budget.budget_id]
        : [expenseId, userId, budget.budget_id];
      await client.query(
        `UPDATE expenses SET from_cash_investment_id = NULL
         WHERE expense_id = $1 AND ${access} AND budget_id = ${budgetParam}`,
        params,
      );
      return { success: true };
    }

    if (persistence === "expense_debt" || edgeId.startsWith("fk:expense_debt:")) {
      const expenseId = Number(body?.source_id ?? edgeId.replace(/^fk:expense_debt:/, ""));
      const access = groupId ? groupAccessClauseAt("", 2, 3) : soloUserClauseAt("", 2);
      const budgetParam = groupId ? "$4" : "$3";
      const params = groupId
        ? [expenseId, userId, groupId, budget.budget_id]
        : [expenseId, userId, budget.budget_id];
      await client.query(
        `UPDATE expenses SET debt_id = NULL
         WHERE expense_id = $1 AND ${access} AND budget_id = ${budgetParam}`,
        params,
      );
      return { success: true };
    }

    const source = parseNodeKey(String(body?.source ?? ""));
    const target = parseNodeKey(String(body?.target ?? ""));
    if (source?.type === "debt" && target) {
      const access = groupId ? groupAccessClauseAt("", 2, 3) : soloUserClauseAt("", 2);
      const params = groupId ? [source.id, userId, groupId] : [source.id, userId];
      await client.query(
        `UPDATE debt SET linked_asset_type = NULL, linked_asset_id = NULL WHERE dbt_id = $1 AND ${access}`,
        params,
      );
      return { success: true };
    }

    throw createError({ statusCode: 400, statusMessage: "Unable to delete edge: unknown persistence." });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("account-map edge delete failed", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to delete account map edge.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
