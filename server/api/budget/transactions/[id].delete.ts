import { createError, getCookie } from "h3";
import { createDbClient } from "../../../utils/db";
import { SESSION_COOKIE_NAME } from "../../../utils/session";

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    throw createError({
      statusCode: 401,
      statusMessage: "You must be logged in to delete a transaction.",
    });
  }

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
    const sessionResult = await client.query(
      `SELECT user_id FROM app_sessions WHERE session_token = $1 AND expires_at > NOW()`,
      [sessionToken],
    );

    const userId = sessionResult.rows[0]?.user_id;
    if (!userId) {
      throw createError({
        statusCode: 401,
        statusMessage: "Session expired. Please log in again.",
      });
    }

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
