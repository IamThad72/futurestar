import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { getBudgetById, listMonthAssignments } from "../../utils/budgetAccess";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const query = getQuery(event);
  let budgetId: number | undefined;
  let year: number | undefined;

  if (query.budget_id != null && query.budget_id !== "") {
    budgetId = Number(query.budget_id);
    if (!Number.isFinite(budgetId) || budgetId <= 0) {
      throw createError({ statusCode: 400, statusMessage: "Invalid budget_id." });
    }
  }
  if (query.year != null && query.year !== "") {
    year = Number(query.year);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      throw createError({ statusCode: 400, statusMessage: "Invalid year." });
    }
    year = Math.trunc(year);
  }

  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    if (budgetId != null) {
      await getBudgetById(client, userId, groupId, budgetId);
    }
    const assignments = await listMonthAssignments(client, userId, groupId, { budgetId, year });
    return { assignments };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("month-assignments list failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to list month budget assignments." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
