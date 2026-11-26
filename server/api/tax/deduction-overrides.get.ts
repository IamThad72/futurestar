import { createError } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { listTaxDeductionOverrides, logTaxProfileSetup, taxProfileUnavailable } from "../../utils/taxHouseholdProfile";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const listed = await listTaxDeductionOverrides(client, userId, groupId);
    if (listed.unavailable) logTaxProfileSetup();
    return listed;
  } catch (error: unknown) {
    if (taxProfileUnavailable(error)) {
      logTaxProfileSetup(error);
      return { overrides: [], unavailable: true, reason: "missing_table" };
    }
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("deduction overrides failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load deduction overrides." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
