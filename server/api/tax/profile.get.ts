import { createError } from "h3";
import { getSessionUserId } from "../../utils/auth";
import { createDbClient } from "../../utils/db";
import { loadTaxProfile } from "../../utils/taxProfile";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const client = createDbClient();
  try {
    await client.connect();
    return await loadTaxProfile(client, userId);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("tax profile load failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load the tax profile." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
