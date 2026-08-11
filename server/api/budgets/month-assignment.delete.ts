import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { clearMonthAssignment, getBudgetForPeriod, parseYearMonth } from "../../utils/budgetAccess";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const query = getQuery(event);
  const { year, month } = parseYearMonth(query.year, query.month);
  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    await clearMonthAssignment(client, userId, groupId, year, month);
    const { budget, is_override, is_inferred } = await getBudgetForPeriod(
      client,
      userId,
      groupId,
      year,
      month,
    );
    return { success: true, year, month, budget, is_override, is_inferred };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("month-assignment delete failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to clear month budget assignment." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
