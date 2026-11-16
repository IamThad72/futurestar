import { createError, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { requirePrivateUserId } from "../../../utils/privateUserAccess";

const BODY_WORDS = ["shoulder", "knee", "back", "wrist", "elbow", "hip", "neck", "ankle", "overhead"];

function muscleList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item || "").trim()).filter(Boolean);
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

export default defineEventHandler(async (event) => {
  await requirePrivateUserId(event);
  const body = (await readBody(event)) as Record<string, unknown>;
  const exerciseId = String(body?.exerciseId || body?.exercise_id || "").trim();
  const note = String(body?.note || "").toLowerCase();
  if (!exerciseId || exerciseId.length > 80) {
    throw createError({ statusCode: 400, statusMessage: "Choose an exercise from the catalog." });
  }

  const avoid = BODY_WORDS.filter((word) => note.includes(word));
  const client = createDbClient();
  try {
    await client.connect();
    const current = await client.query(
      `SELECT exercise_id, name, target_muscles
       FROM exercise_catalog
       WHERE exercise_id = $1`,
      [exerciseId],
    );
    const row = current.rows[0];
    if (!row) {
      throw createError({ statusCode: 404, statusMessage: "That exercise is not in the catalog." });
    }
    const muscles = muscleList(row.target_muscles).slice(0, 4);
    if (!muscles.length) return { alternatives: [], note: "This is a logging aid, not a medical judgment." };

    const found = await client.query(
      `SELECT exercise_id, name, equipment_key
       FROM exercise_catalog
       WHERE exercise_id <> $1
         AND lower(target_muscles::text) LIKE ANY($2::text[])
       ORDER BY lower(name)
       LIMIT 40`,
      [exerciseId, muscles.map((muscle) => `%${muscle.toLowerCase().replace(/[%_\\]/g, "")}%`)],
    );
    const alternatives = found.rows
      .map((item) => ({
        exerciseId: String(item.exercise_id),
        name: String(item.name || ""),
        equipment: String(item.equipment_key || ""),
      }))
      .filter((item) => item.name && !avoid.some((word) => item.name.toLowerCase().includes(word)))
      .slice(0, 5);

    return {
      alternatives,
      note: "This is a logging aid, not a medical judgment.",
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("journal swap failed", error);
    throw createError({ statusCode: 500, statusMessage: "Could not find another exercise." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
