import { createError, getQuery } from "h3";
import { createDbClient } from "../utils/db";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const category = String(query.category ?? "").trim();

  if (!category) {
    throw createError({
      statusCode: 400,
      statusMessage: "Category is required.",
    });
  }

  const client = createDbClient();

  try {
    await client.connect();
    const result = await client.query(
      `SELECT classification_type
       FROM asset_classification
       WHERE asset_category = $1
       ORDER BY classification_type ASC`,
      [category],
    );

    return { classifications: result.rows.map((row: { classification_type: string }) => row.classification_type) };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to load classifications.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
