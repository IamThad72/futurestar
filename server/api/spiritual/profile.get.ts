import { createError } from "h3";
import { createDbClient } from "../../utils/db";
import { requirePrivateUserId } from "../../utils/privateUserAccess";
import { calendarKind, readFaithProfile } from "../../utils/faithProfile";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const client = createDbClient();
  try {
    await client.connect();
    const loaded = await readFaithProfile(client, userId);
    return { ...loaded, calendar: calendarKind(loaded.profile) };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("faith profile failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load faith settings." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
