import { createError } from "h3";
import { createDbClient } from "../utils/db";

export default defineEventHandler(async () => {
  const client = createDbClient();

  try {
    await client.connect();
    const result = await client.query(
      `SELECT DISTINCT debt_type
       FROM personal_debts
       WHERE debt_type IS NOT NULL AND debt_type != ''
       ORDER BY debt_type ASC`,
    );

    return {
      debtTypes: result.rows.map((row: { debt_type?: string }) => row.debt_type).filter(Boolean),
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to load debt types.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
