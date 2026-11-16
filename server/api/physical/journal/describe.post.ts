import { createError, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { requirePrivateUserId } from "../../../utils/privateUserAccess";
import { catalogNameMatch } from "~/utils/workoutPlan.js";
import { parseSessionSentence } from "~/utils/sessionSentence.js";

export default defineEventHandler(async (event) => {
  await requirePrivateUserId(event);
  const body = (await readBody(event)) as Record<string, unknown>;
  const moves = parseSessionSentence(body?.text);
  if (!moves.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "Describe the session, such as 3x8 squat at 185, then 20 minutes on the bike.",
    });
  }

  const words = [...new Set(moves.flatMap((move) => move.name.toLowerCase().split(/\s+/)).filter((word) => word.length > 2))];
  const patterns = words.map((word) => `%${word.replace(/[%_\\]/g, "")}%`).slice(0, 12);
  const client = createDbClient();
  try {
    await client.connect();
    const catalog = patterns.length
      ? await client.query(
          `SELECT exercise_id, name, equipment_key
           FROM exercise_catalog
           WHERE lower(name) LIKE ANY($1::text[])
           ORDER BY lower(name)
           LIMIT 40`,
          [patterns],
        )
      : { rows: [] };
    const rows = catalog.rows.map((row) => ({
      exerciseId: String(row.exercise_id || ""),
      name: String(row.name || ""),
      equipment: String(row.equipment_key || ""),
    }));
    const exercises = moves.map((move) => {
      const match = catalogNameMatch(move.name, rows);
      return {
        name: match?.name || move.name,
        exerciseId: match?.exerciseId || null,
        equipment: match?.equipment || null,
        sets: move.sets,
        reps: move.durationSeconds ? null : move.reps,
        weight: move.weight,
        weightUnit: move.weightUnit,
        durationSeconds: move.durationSeconds,
        matched: Boolean(match),
      };
    });
    return {
      exercises,
      unmatched: exercises.filter((item) => !item.matched).map((item) => item.name),
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("journal describe failed", error);
    throw createError({ statusCode: 500, statusMessage: "Could not read that session." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
