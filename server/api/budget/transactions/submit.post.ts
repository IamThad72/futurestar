import { createError, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId } from "../../../utils/group";
import { recordBudgetTransaction } from "../../../utils/recordBudgetTransaction";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const body = await readBody(event);
  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    await recordBudgetTransaction(client, userId, groupId, body ?? {});
    return { success: true };
  } catch (error) {
    if (error?.statusCode) throw error;
    console.error("Transaction submit failed", error);
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "Failed to add transaction.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
