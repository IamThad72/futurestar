import { isRepsLoggedAerobic } from "~/utils/enduranceExercises";
import { isYogaExercise } from "~/utils/flexibilityExercises";

export const WORKOUT_EXERCISE_DND = "application/x-futurestar-exercise";
export const WORKOUT_ITEM_DND = "application/x-futurestar-workout-item";
export const CATALOG_PICKER_KEY = Symbol("catalogPicker");

function parseLeadingInt(value, fallback) {
  const match = String(value ?? "").match(/\d+/);
  if (!match) return fallback;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : fallback;
}

const LB_PER_KG = 2.2046226218;

/**
 * Keep weight/reps inputs to 3 whole digits (0–999).
 * Weight may include one decimal place (e.g. 135.5).
 */
export function limitThreeDigitInput(raw, { integer = false } = {}) {
  if (raw == null) return { text: "", value: null };
  const s = String(raw);
  let text;
  if (integer) {
    text = s.replace(/\D/g, "").slice(0, 3);
  } else {
    const cleaned = s.replace(/[^\d.]/g, "");
    const dot = cleaned.indexOf(".");
    if (dot === -1) {
      text = cleaned.slice(0, 3);
    } else {
      const whole = cleaned.slice(0, dot).replace(/\D/g, "").slice(0, 3);
      const frac = cleaned.slice(dot + 1).replace(/\D/g, "").slice(0, 1);
      text = `${whole}.${frac}`;
    }
  }
  if (text === "" || text === ".") return { text, value: null };
  const n = Number(text);
  const value = Number.isFinite(n) ? Math.min(n, 999) : null;
  return { text, value };
}

const MAX_DURATION_MINUTES = 1440;

/** Journal cardio duration: minutes with up to two decimal places (e.g. 20.5). */
export function limitMinuteInput(raw) {
  if (raw == null) return { text: "", value: null };
  const cleaned = String(raw).replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  let text;
  if (dot === -1) {
    text = cleaned.slice(0, 4);
  } else {
    const whole = cleaned.slice(0, dot).replace(/\D/g, "").slice(0, 4);
    const frac = cleaned.slice(dot + 1).replace(/\D/g, "").slice(0, 2);
    text = `${whole}.${frac}`;
  }
  if (text === "" || text === ".") return { text, value: null };
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return { text, value: null };
  if (n > MAX_DURATION_MINUTES) return { text: String(MAX_DURATION_MINUTES), value: MAX_DURATION_MINUTES };
  return { text, value: n };
}

export function formatDurationMinutes(durationSeconds) {
  if (durationSeconds == null || durationSeconds === "") return "";
  const minutes = Number(durationSeconds) / 60;
  if (!Number.isFinite(minutes) || minutes < 0) return "";
  const rounded = Math.round(minutes * 100) / 100;
  return String(rounded);
}

export function minutesToDurationSeconds(minutes) {
  if (minutes == null || minutes === "") return null;
  const n = Number(minutes);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(Math.min(n, MAX_DURATION_MINUTES) * 60);
}

/** Stored and displayed weights are pounds. Convert leftover kg values on load. */
export function weightInLb(weight, unit) {
  if (weight == null || weight === "") return null;
  const n = Number(weight);
  if (!Number.isFinite(n)) return null;
  const unitRaw = String(unit || "lb").trim().toLowerCase();
  if (unitRaw === "kg") return Math.round(n * LB_PER_KG * 10) / 10;
  return n;
}

const LOADED_WEIGHT_EQUIPMENT = new Set(["dumbbell", "kettlebell", "barbell"]);

export function exerciseEquipmentKey(exercise) {
  return String(
    exercise?.equipment || exercise?.equipmentKey || exercise?.equipment_key || "",
  )
    .trim()
    .toLowerCase();
}

export function isTimeBasedExercise(exercise) {
  if (isRepsLoggedAerobic(exercise)) return false;
  const name = String(exercise?.name || exercise?.exerciseName || "");
  if (isYogaExercise(name)) return true;
  const equipment = exerciseEquipmentKey(exercise);
  if (equipment === "outdoor" || equipment === "machine") return true;
  const reps = String(exercise?.repetitions || exercise?.reps || "");
  if (/\bmin\b/i.test(reps)) return true;
  if (exercise?.durationSeconds != null && exercise.durationSeconds !== "") return true;
  return /\b(sec|hold)\b/i.test(reps);
}

/** External load (lbs). Bodyweight, cardio, rope, stretch, and yoga do not use Wgt. */
export function usesLoadedWeight(exercise) {
  const equipment = exerciseEquipmentKey(exercise);
  if (equipment) return LOADED_WEIGHT_EQUIPMENT.has(equipment);
  const name = String(exercise?.name || exercise?.exerciseName || "").toLowerCase();
  return /\b(dumbbell|kettlebell|barbell)\b/.test(name);
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
  const repsText = String(exercise?.repetitions ?? exercise?.reps ?? "");
  let reps = parseLeadingInt(exercise?.repetitions ?? exercise?.reps, timeBased ? 1 : 10);
  if (isRepsLoggedAerobic(exercise) && /\b(sec|min|hold)\b/i.test(repsText)) {
    reps = 10;
  }
  let durationSeconds = null;
  if (timeBased) {
    const equipment = exerciseEquipmentKey(exercise);
    const name = String(exercise?.name || exercise?.exerciseName || "");
    if (/\bmin\b/i.test(repsText) || equipment === "outdoor" || equipment === "machine") {
      durationSeconds = parseLeadingInt(repsText, 20) * 60;
    } else if (/\bsec\b/i.test(repsText)) {
      const nums = repsText.match(/\d+/g);
      const holdSec = nums?.length ? Number(nums[nums.length - 1]) : 30;
      durationSeconds = Number.isFinite(holdSec) ? holdSec : 30;
    } else if (isYogaExercise(name) || /\bhold\b/i.test(repsText)) {
      durationSeconds = 30;
    } else {
      durationSeconds = 20 * 60;
    }
    reps = null;
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
    equipmentKey: exerciseEquipmentKey(exercise) || null,
    usesWeight: usesLoadedWeight(exercise),
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
