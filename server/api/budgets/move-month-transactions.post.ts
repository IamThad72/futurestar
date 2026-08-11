import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { getBudgetById, parseYearMonth, setMonthAssignment } from "../../utils/budgetAccess";
import { moveMonthTransactionsToBudget } from "../../utils/budgetMove";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const body = await readBody(event);
  const { year, month } = parseYearMonth(body?.year, body?.month);
  const budgetId = Number(body?.budget_id);
  if (!Number.isFinite(budgetId) || budgetId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "Invalid budget_id." });
  }
  const pinAssignment = body?.pin_assignment !== false;

  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const budget = await getBudgetById(client, userId, groupId, budgetId);
    const move_result = await moveMonthTransactionsToBudget(
      client,
      userId,
      groupId,
      year,
      month,
      budget.budget_id,
    );
    let assignment = null;
    if (pinAssignment) {
      assignment = await setMonthAssignment(client, userId, groupId, year, month, budget.budget_id);
    }
    return { budget, assignment, move_result };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("move-month-transactions failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to move month transactions." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
