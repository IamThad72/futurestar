import { createError, readBody } from "h3";
import { getSessionUserId } from "../../utils/auth";
import { createDbClient } from "../../utils/db";
import { saveTaxProfile } from "../../utils/taxProfile";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const body = await readBody(event);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: "Send a tax profile." });
  }
  const client = createDbClient();
  try {
    await client.connect();
    const saved = await saveTaxProfile(client, userId, body as Record<string, unknown>);
    return { success: true, ...saved };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("tax profile save failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to save the tax profile." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
