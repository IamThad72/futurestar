import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { omitGroupScope, requirePrivateUserId } from "../../utils/privateUserAccess";
import { listEnduranceExercises } from "../../utils/exerciseCatalog";

export default defineEventHandler(async (event) => {
  await requirePrivateUserId(event);
  const query = omitGroupScope(getQuery(event) as Record<string, unknown>);
  const equipment = String(query.equipment || "all").trim() || "all";
  const kind = String(query.kind || "all").trim() || "all";
  const q = String(query.q || "").trim();
  const offset = query.offset != null ? parseInt(String(query.offset), 10) : 0;
  const limit = query.limit != null ? parseInt(String(query.limit), 10) : 48;

  const client = createDbClient();
  try {
    await client.connect();
    return await listEnduranceExercises(client, {
      equipment,
      kind,
      q,
      offset: Number.isFinite(offset) ? offset : 0,
      limit: Number.isFinite(limit) ? limit : 48,
    });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("physical endurance failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load cardio exercises." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
