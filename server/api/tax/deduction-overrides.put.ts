import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import {
  listTaxDeductionOverrides,
  saveTaxDeductionOverride,
  TAX_DEDUCTION_SETUP_MESSAGE,
  taxProfileSetupError,
  taxProfileUnavailable,
} from "../../utils/taxHouseholdProfile";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const body = (await readBody(event)) || {};
  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    await saveTaxDeductionOverride(client, userId, groupId, body);
    const listed = await listTaxDeductionOverrides(client, userId, groupId);
    return { success: true, ...listed };
  } catch (error: unknown) {
    if (taxProfileUnavailable(error)) throw taxProfileSetupError(error, TAX_DEDUCTION_SETUP_MESSAGE);
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("deduction override save failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to save deduction override." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
