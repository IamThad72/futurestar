import { createError, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId } from "../../../utils/group";
import { parsePayBatchId } from "../../../utils/grossPayTransaction";
import { recordBudgetTransaction } from "../../../utils/recordBudgetTransaction";

/**
 * Save a gross paycheck as one database transaction.
 * Every line becomes a budget actual, and the same amounts are added to the
 * stored tax-page totals. A failure rolls all of it back.
 */
export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const body = await readBody(event);
  const lines = Array.isArray(body?.lines) ? body.lines : [];
  const payBatchId = parsePayBatchId(body?.pay_batch_id);
  const transactionDate = body?.transaction_date ?? body?.date;
  const description = body?.description != null ? String(body.description).trim() : null;

  if (!lines.length) {
    throw createError({ statusCode: 400, statusMessage: "Paycheck lines are required." });
  }
  if (!payBatchId) {
    throw createError({ statusCode: 400, statusMessage: "Paycheck batch id is required." });
  }
  if (!transactionDate) {
    throw createError({ statusCode: 400, statusMessage: "Transaction date is required." });
  }

  const client = createDbClient();
  try {
    await client.connect();
    await client.query("BEGIN");
    try {
      const groupId = await getUserGroupId(client, userId);
      for (const line of lines) {
        if (!line || typeof line !== "object") {
          throw createError({ statusCode: 400, statusMessage: "Invalid paycheck line." });
        }
        await recordBudgetTransaction(client, userId, groupId, {
          ...line,
          transaction_date: line.transaction_date ?? transactionDate,
          description: line.description ?? description,
          from_gross_pay: true,
          pay_batch_id: payBatchId,
        });
      }
      await client.query("COMMIT");
      return { success: true, count: lines.length };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    if (error?.statusCode) throw error;
    console.error("Paycheck submit failed", error);
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "Failed to save paycheck.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
