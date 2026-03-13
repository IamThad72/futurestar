import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const email = String(query.email ?? "").trim().toLowerCase();

  if (!email) {
    throw createError({
      statusCode: 400,
      statusMessage: "Email is required.",
    });
  }

  const client = createDbClient();

  try {
    await client.connect();
    const result = await client.query(
      "SELECT 1 FROM app_users WHERE email = $1",
      [email],
    );

    return { available: result.rowCount === 0 };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to check email.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
