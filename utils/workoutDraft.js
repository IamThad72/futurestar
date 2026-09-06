export const WORKOUT_EXERCISE_DND = "application/x-futurestar-exercise";
export const WORKOUT_ITEM_DND = "application/x-futurestar-workout-item";

function parseLeadingInt(value, fallback) {
  const match = String(value ?? "").match(/\d+/);
  if (!match) return fallback;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : fallback;
}

export function isTimeBasedExercise(exercise) {
  const reps = String(exercise?.repetitions || exercise?.reps || "");
  const equipment = String(exercise?.equipment || exercise?.equipmentKey || exercise?.equipment_key || "");
  if (equipment === "outdoor" || equipment === "machine") return true;
  if (exercise?.durationSeconds != null && exercise.durationSeconds !== "") return true;
  return /\b(min|sec|hold)\b/i.test(reps);
}

export function catalogExerciseId(exercise) {
  const direct = String(exercise?.exerciseId || exercise?.exercise_id || "").trim();
  if (direct) return direct;
  if (exercise?.featured) return String(exercise?.id || "").trim();
  return "";
}

export function programmingDefaults(exercise) {
  const timeBased = isTimeBasedExercise(exercise);
  const sets = parseLeadingInt(exercise?.sets, timeBased ? 1 : 3);
  const reps = parseLeadingInt(exercise?.repetitions ?? exercise?.reps, timeBased ? 1 : 8);
  let durationSeconds = null;
  const repsText = String(exercise?.repetitions || "");
  if (/\bmin\b/i.test(repsText) || exercise?.equipment === "outdoor" || exercise?.equipment === "machine") {
    durationSeconds = parseLeadingInt(repsText, 20) * 60;
  } else if (/\bsec\b/i.test(repsText)) {
    durationSeconds = parseLeadingInt(repsText, 30);
  }
  return {
    sets,
    reps,
    weight: null,
    weightUnit: "lb",
    durationSeconds,
  };
}

export function payloadFromExercise(exercise) {
  const exerciseId = catalogExerciseId(exercise);
  const defaults = programmingDefaults(exercise);
  return {
    exerciseId,
    name: String(exercise?.name || "Exercise").trim() || "Exercise",
    gifUrl: exercise?.gifUrl || exercise?.gif_url || "",
    sets: defaults.sets,
    reps: defaults.reps,
    weight: defaults.weight,
    weightUnit: defaults.weightUnit,
    durationSeconds: defaults.durationSeconds,
  };
}

export function readDragPayload(event) {
  const transfer = event?.dataTransfer;
  if (!transfer) return null;
  const raw =
    transfer.getData(WORKOUT_EXERCISE_DND) ||
    transfer.getData("text/plain") ||
    "";
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const exerciseId = catalogExerciseId(parsed);
    if (!exerciseId) return null;
    return { ...payloadFromExercise(parsed), ...parsed, exerciseId };
  } catch {
    return null;
  }
}
