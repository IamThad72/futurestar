import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { listTaxAnnualTotals } from "../../utils/taxAnnualTotals";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const query = getQuery(event);
  const yearRaw = query.year != null ? parseInt(String(query.year), 10) : new Date().getFullYear();
  const taxYear = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);

    // Stored household totals only. Gross-pay actuals add to these rows.
    const listed = await listTaxAnnualTotals(client, userId, groupId, taxYear);

    return {
      tax_year: taxYear,
      ...listed,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("tax annual totals failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load tax annual totals." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
