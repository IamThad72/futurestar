import { createError, getQuery, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { saveTaxHouseholdProfile, taxProfileSetupError, taxProfileUnavailable } from "../../utils/taxHouseholdProfile";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const query = getQuery(event);
  const body = (await readBody(event)) || {};
  const yearRaw = body?.tax_year != null ? parseInt(String(body.tax_year), 10) : parseInt(String(query.year ?? ""), 10);
  const taxYear = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();
  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const saved = await saveTaxHouseholdProfile(client, userId, groupId, taxYear, body);
    return {
      household_key: saved.householdKey,
      tax_year: taxYear,
      profile: saved.profile,
      unavailable: false,
    };
  } catch (error: unknown) {
    if (taxProfileUnavailable(error)) throw taxProfileSetupError(error);
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("tax household profile save failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to save tax profile." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
