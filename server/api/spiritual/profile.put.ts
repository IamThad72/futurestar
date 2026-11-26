import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../utils/privateUserAccess";
import { calendarKind, saveFaithProfile } from "../../utils/faithProfile";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const body = omitGroupScope(((await readBody(event)) || {}) as Record<string, unknown>);
  const client = createDbClient();
  try {
    await client.connect();
    const saved = await saveFaithProfile(client, userId, body);
    return { ...saved, calendar: calendarKind(saved.profile) };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("faith profile save failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to save faith settings." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
