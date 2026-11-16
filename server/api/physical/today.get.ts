import { createError } from "h3";
import { createDbClient } from "../../utils/db";
import { requirePrivateUserId } from "../../utils/privateUserAccess";
import { buildNutritionComparison, getActiveNutritionPlan, getDailyMacros } from "../../utils/nutritionIntake";
import { isMissingRelation } from "../../utils/workouts";
import { addDaysIso, todayIsoDate } from "~/utils/liturgicalCalendar";
import { summarizeTraining, todaySentence } from "~/utils/todayNote.js";
import { generateNote } from "../../utils/aiNote";

export default defineEventHandler(async (event) => {
  const userId = await requirePrivateUserId(event);
  const today = todayIsoDate();
  const start = addDaysIso(today, -6);
  const client = createDbClient();
  try {
    await client.connect();
    const [macros, plan] = await Promise.all([
      getDailyMacros(client, userId, today),
      getActiveNutritionPlan(client, userId),
    ]);
    const comparison = buildNutritionComparison(macros, plan);
    let trainingRows: Array<Record<string, unknown>> = [];
    try {
      const sessions = await client.query(
        `SELECT s.session_id, to_char(s.performed_at::date, 'YYYY-MM-DD') AS day, s.name, e.exercise_name
         FROM workout_journal_sessions s
         LEFT JOIN workout_journal_exercises e ON e.session_id = s.session_id
         WHERE s.user_id = $1
           AND s.performed_at::date >= $2::date
           AND s.performed_at::date <= $3::date`,
        [userId, start, today],
      );
      trainingRows = sessions.rows;
    } catch (error) {
      if (!isMissingRelation(error)) throw error;
    }
    const training = summarizeTraining(
      trainingRows.map((row) => ({
        sessionId: Number(row.session_id),
        day: String(row.day).slice(0, 10),
        name: row.name,
        exerciseName: row.exercise_name,
      })),
      today,
    );
    const facts = {
      loggedToday: training.loggedToday,
      sessions: training.sessions,
      mobilitySessions: training.mobilitySessions,
      kcalRemaining: comparison.remaining ? Math.round(comparison.remaining.kcal) : null,
      proteinRemaining: comparison.remaining ? Math.round(comparison.remaining.protein_g) : null,
      kcalConsumed: Math.round(comparison.consumed.kcal),
      proteinConsumed: Math.round(comparison.consumed.protein_g),
    };
    const fallback = todaySentence(facts);
    const text =
      (await generateNote(
        "Write one sentence for a physical home page from these counts. Do not prescribe a diet, a diagnosis, or a new program.",
        facts,
      )) || fallback;
    return { ...facts, text };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("physical today failed", error);
    throw createError({ statusCode: 500, statusMessage: "Could not load today." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
