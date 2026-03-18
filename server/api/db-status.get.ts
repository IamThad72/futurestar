import { createError } from "h3";
import { createDbClient } from "../utils/db";

export default defineEventHandler(async () => {
  const client = createDbClient();
  try {
    await client.connect();
    await client.query("SELECT 1");

    return {
      connected: true,
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Database connection failed.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
