import { createError } from "h3";
import { createDbClient } from "../utils/db";

export default defineEventHandler(async () => {
  const client = createDbClient();

  try {
    await client.connect();
    const result = await client.query(
      `SELECT DISTINCT asset_category
       FROM asset_classification
       WHERE asset_category IS NOT NULL
       ORDER BY asset_category ASC`,
    );

    const categories = result.rows
      .map((row: { asset_category?: string | null }) => row.asset_category)
      .filter(Boolean);
    if (!categories.includes("Debt")) {
      categories.push("Debt");
    }
    if (!categories.includes("Insurance")) {
      categories.push("Insurance");
    }
    categories.sort((a, b) => String(a).localeCompare(String(b)));
    return { categories };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to load asset categories.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
