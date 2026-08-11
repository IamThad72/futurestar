import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { getActiveBudget, getBudgetById, parseYearMonth, setMonthAssignment } from "../../utils/budgetAccess";
import { moveMonthTransactionsToBudget } from "../../utils/budgetMove";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const body = await readBody(event);
  const { year, month } = parseYearMonth(body?.year, body?.month);
  const budgetId = Number(body?.budget_id);
  if (!Number.isFinite(budgetId) || budgetId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "Invalid budget_id." });
  }
  const moveTransactions = body?.move_transactions !== false;

  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const assignment = await setMonthAssignment(client, userId, groupId, year, month, budgetId);
    const budget = await getBudgetById(client, userId, groupId, assignment.budget_id);
    const active = await getActiveBudget(client, userId, groupId);

    let move_result = null;
    if (moveTransactions) {
      move_result = await moveMonthTransactionsToBudget(
        client,
        userId,
        groupId,
        year,
        month,
        budget.budget_id,
      );
    }

    return {
      assignment,
      budget,
      is_override: true,
      active_budget_id: active.budget_id,
      move_result,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("month-assignment put failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to set month budget assignment." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
