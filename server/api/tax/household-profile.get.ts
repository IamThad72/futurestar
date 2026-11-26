import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { annualTotalsHouseholdKey } from "../../utils/taxAnnualTotals";
import { logTaxProfileSetup, readTaxHouseholdProfile, taxProfileUnavailable } from "../../utils/taxHouseholdProfile";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const query = getQuery(event);
  const yearRaw = query.year != null ? parseInt(String(query.year), 10) : new Date().getFullYear();
  const taxYear = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();
  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const householdKey = annualTotalsHouseholdKey(userId, groupId);
    try {
      const loaded = await readTaxHouseholdProfile(client, userId, groupId, taxYear);
      return {
        household_key: loaded.householdKey,
        tax_year: taxYear,
        profile: loaded.profile,
        unavailable: false,
      };
    } catch (error) {
      if (taxProfileUnavailable(error)) {
        logTaxProfileSetup(error);
        return {
          household_key: householdKey,
          tax_year: taxYear,
          profile: null,
          unavailable: true,
          reason: "missing_table",
        };
      }
      throw error;
    }
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("tax household profile failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load tax profile." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
