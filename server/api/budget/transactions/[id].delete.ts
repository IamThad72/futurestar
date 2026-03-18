import { createError } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const id = getRouterParam(event, "id");
  if (!id || !/^\d+$/.test(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid transaction ID.",
    });
  }

  const client = createDbClient();

  try {
    await client.connect();
    const result = await client.query(
      `DELETE FROM budget_transactions WHERE transaction_id = $1 AND user_id = $2 RETURNING transaction_id`,
      [id, userId],
    );

    if (result.rowCount === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: "Transaction not found.",
      });
    }

    return { success: true };
  } catch (error) {
    if (error?.statusCode) throw error;
    console.error("Transaction delete failed", error);
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "Failed to delete transaction.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
