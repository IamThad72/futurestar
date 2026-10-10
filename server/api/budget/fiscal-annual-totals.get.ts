import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { listFiscalAnnualTotals } from "../../utils/fiscalAnnualTotals";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const query = getQuery(event);
  const yearRaw = query.year != null ? parseInt(String(query.year), 10) : new Date().getFullYear();
  const taxYear = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const { income, pretax, posttax } = await listFiscalAnnualTotals(client, userId, groupId, taxYear);

    // Stored Gross / Net only. Taxable is Gross − the five Pre-Tax kinds.
    return {
      tax_year: taxYear,
      income,
      pretax,
      posttax,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("fiscal annual totals failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load fiscal annual totals." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
