import { createError } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId, groupAccessClauseAt, soloUserClauseAt } from "../../../utils/group";
import {
  GROSS_PAY_TX_COLUMNS,
  loadPaycheckRows,
  reverseStoredTransactionEffects,
} from "../../../utils/grossPayTransaction";

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
    const groupId = await getUserGroupId(client, userId);
    await client.query("BEGIN");

    try {
      const accessClause = groupId ? groupAccessClauseAt("", 2, 3) : soloUserClauseAt("", 2);
      const params = groupId ? [id, userId, groupId] : [id, userId];

      const existing = await client.query(
        `SELECT ${GROSS_PAY_TX_COLUMNS}
         FROM budget_transactions
         WHERE transaction_id = $1 AND ${accessClause}
         FOR UPDATE`,
        params,
      );

      if (existing.rowCount === 0) {
        throw createError({
          statusCode: 404,
          statusMessage: "Transaction not found.",
        });
      }

      const rows = await loadPaycheckRows(client, userId, groupId, existing.rows[0]);
      for (const row of rows) {
        await reverseStoredTransactionEffects(client, userId, groupId, row);
      }

      const ids = rows.map((row) => Number(row.transaction_id)).filter((n) => Number.isFinite(n) && n > 0);
      const deleteAccess = groupId ? groupAccessClauseAt("", 2, 3) : soloUserClauseAt("", 2);
      const deleteParams = groupId ? [ids, userId, groupId] : [ids, userId];
      const deleted = await client.query(
        `DELETE FROM budget_transactions
         WHERE transaction_id = ANY($1::int[]) AND ${deleteAccess}`,
        deleteParams,
      );

      if ((deleted.rowCount ?? 0) !== ids.length) {
        throw createError({
          statusCode: 409,
          statusMessage: "Could not remove every paycheck transaction.",
        });
      }

      await client.query("COMMIT");
      return { success: true, deleted_count: ids.length };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
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
