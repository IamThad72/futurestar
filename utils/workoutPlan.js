/** Pure helpers for the workout-plan prototype. The model may only keep catalog ids. */

export const PLAN_GOALS = [
  { key: "strength", label: "Strength" },
  { key: "weight-loss", label: "Weight loss" },
  { key: "endurance", label: "Endurance" },
  { key: "mobility", label: "Mobility" },
  { key: "mixed", label: "Mixed" },
];

export const PLAN_EQUIPMENT = [
  { key: "body", label: "Bodyweight" },
  { key: "dumbbell", label: "Dumbbells" },
  { key: "kettlebell", label: "Kettlebells" },
  { key: "machine", label: "Machines" },
  { key: "outdoor", label: "Outdoor" },
];

const EQUIPMENT_KEYS = new Set(PLAN_EQUIPMENT.map((item) => item.key));

const PATTERNS = [
  { key: "mobility", test: /stretch|yoga|mobility|pose/ },
  { key: "conditioning", test: /run|jog|bike|cycle|burpee|sprint|jump rope/ },
  { key: "squat", test: /squat|lunge|step-up|step up/ },
  { key: "hinge", test: /deadlift|hinge|swing|good morning|hip thrust/ },
  { key: "push", test: /press|push-up|push up|dip|bench/ },
  { key: "pull", test: /\brow\b|pull-up|pull up|chin|pulldown/ },
  { key: "core", test: /plank|crunch|carry|pallof|dead bug|sit-up|sit up/ },
];

function textOf(row) {
  return [row.name, row.bodyParts, row.body_parts, row.targetMuscles, row.target_muscles]
    .flat()
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function candidateFrom(row) {
  return {
    exerciseId: String(row.exerciseId || row.exercise_id || "").trim(),
    name: String(row.name || "").trim(),
    equipment: String(row.equipment || row.equipment_key || "").trim(),
  };
}

export function pickCandidates(rows, recentIds = [], limitPerPattern = 4) {
  const buckets = new Map();
  const chosen = new Set();
  const recent = new Set(recentIds.map((id) => String(id)));

  for (const row of rows || []) {
    const item = candidateFrom(row);
    if (!item.exerciseId || !item.name || chosen.has(item.exerciseId)) continue;
    if (!recent.has(item.exerciseId)) continue;
    chosen.add(item.exerciseId);
    const list = buckets.get("recent") || [];
    if (list.length < limitPerPattern) {
      list.push(item);
      buckets.set("recent", list);
    }
  }

  for (const row of rows || []) {
    const item = candidateFrom(row);
    if (!item.exerciseId || !item.name || chosen.has(item.exerciseId)) continue;
    const blob = textOf(row);
    const pattern = PATTERNS.find((entry) => entry.test.test(blob));
    if (!pattern) continue;
    const list = buckets.get(pattern.key) || [];
    if (list.length >= limitPerPattern) continue;
    list.push(item);
    chosen.add(item.exerciseId);
    buckets.set(pattern.key, list);
  }

  return [...buckets.values()].flat();
}

function whole(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function sessionSeconds(exercises) {
  return (exercises || []).reduce((sum, item) => {
    const sets = Math.max(Number(item.sets) || 1, 1);
    const paced = Math.max(40, (Number(item.reps) || 0) * 3);
    const work = Number(item.durationSeconds) > 0 ? Number(item.durationSeconds) : paced;
    const rest = Number(item.restSeconds) >= 0 ? Number(item.restSeconds) : 60;
    return sum + sets * work + Math.max(sets - 1, 0) * rest;
  }, 0);
}

function catalogIndex(catalog) {
  const list = (catalog || [])
    .map((item) => ({
      exerciseId: String(item.exerciseId || item.exercise_id || "").trim(),
      name: String(item.name || "").trim(),
      equipment: String(item.equipment || item.equipment_key || "").trim(),
    }))
    .filter((item) => item.exerciseId && item.name);
  return { list, byId: new Map(list.map((item) => [item.exerciseId, item])) };
}

function exerciseLine(line) {
  if (typeof line === "string") return { name: line };
  if (!line || typeof line !== "object") return null;
  const name = line.name || line.exercise || line.exerciseName || line.title || line.movement || "";
  return { ...line, name };
}

function listedDays(value) {
  const raw = value?.days || value?.sessions || value?.workouts || value?.week;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") return Object.values(raw);
  return [];
}

function exerciseList(day) {
  const lines = day?.exercises || day?.workout || day?.items || day?.movements || [];
  return Array.isArray(lines) ? lines : [];
}

function lineFrom(line, catalog) {
  const source = exerciseLine(line);
  if (!source) return null;
  const { list, byId } = catalog;
  line = source;
  const durationSeconds = whole(line?.durationSeconds ?? line?.seconds, 0, 0, 3600);
  let sets = whole(line?.sets, 3, 1, 100);
  let reps = whole(line?.reps, 8, 1, 100);
  if (sets > 12 && reps <= 5) {
    reps = Math.min(100, sets);
    sets = 1;
  }
  const base = {
    sets: Math.min(sets, 8),
    reps: durationSeconds > 0 ? null : reps,
    durationSeconds: durationSeconds > 0 ? durationSeconds : null,
    restSeconds: whole(line?.restSeconds, 60, 0, 180),
    notes: String(line?.description || line?.notes || "").trim().slice(0, 240),
  };
  const known = byId.get(String(line?.exerciseId || "").trim());
  if (known) {
    return { ...base, exerciseId: known.exerciseId, name: known.name, equipment: known.equipment, matched: true };
  }
  const name = String(line?.name || "").trim().slice(0, 80);
  const byName = name ? catalogNameMatch(name, list) : null;
  if (byName) {
    return {
      ...base,
      exerciseId: byName.exerciseId,
      name: byName.name,
      equipment: byName.equipment,
      matched: true,
    };
  }
  if (!name) return null;
  const equipment = EQUIPMENT_KEYS.has(String(line?.equipment || "")) ? String(line.equipment) : "body";
  return { ...base, exerciseId: null, name, equipment, matched: false };
}

function normalizeDays(daysIn, catalog, daysPerWeek, fill = false) {
  const index = catalogIndex(catalog);
  const count = whole(daysPerWeek, 5, 1, 5);
  const incoming = Array.isArray(daysIn) ? daysIn : [];
  const parsed = incoming
    .slice(0, 14)
    .map((day, dayIndex) => {
      const list = exerciseList(day);
      const exercises = [];
      for (const line of list.slice(0, 12)) {
        const item = lineFrom(line, index);
        if (item) exercises.push(item);
      }
      const named = String(day?.name || day?.title || `Day ${dayIndex + 1}`).trim().slice(0, 80) || `Day ${dayIndex + 1}`;
      return { name: named, exercises, seconds: sessionSeconds(exercises) };
    })
    .filter((day) => day.exercises.length);
  const days = parsed.slice(0, count);
  if (fill) {
    while (days.length && days.length < count) {
      const source = parsed[days.length % parsed.length];
      days.push({ ...source, name: source.name, exercises: source.exercises.map((item) => ({ ...item })) });
    }
  }
  return days;
}

export function normalizePlan(raw, candidates, minutes, daysPerWeek = 5) {
  const source = raw && typeof raw === "object" ? raw : {};
  const daysIn = Array.isArray(source.days) ? source.days : Array.isArray(source.plan?.days) ? source.plan.days : [];
  const days = normalizeDays(daysIn, candidates, daysPerWeek);
  const budget = Math.max(Number(minutes) || 0, 1) * 60 * 1.15;
  return {
    summary: String(source.summary || "").trim().slice(0, 280),
    days,
    overTime: days.some((day) => day.seconds > budget),
  };
}

/** One week pattern, or up to four blocks when the description changes the work. */
export function normalizeBlocks(raw, catalog, minutes, daysPerWeek, weeks) {
  const source = raw && typeof raw === "object" ? raw : {};
  const total = whole(weeks, 8, 1, 24);
  const count = whole(daysPerWeek, 5, 1, 5);
  let incoming = Array.isArray(source.blocks) && source.blocks.length
    ? source.blocks.slice(0, 8)
    : [{ fromWeek: 1, toWeek: total, days: listedDays(source).length ? listedDays(source) : source.plan?.days }];
  const looseDays = incoming.filter((block) => !listedDays(block).length && exerciseList(block).length);
  if (looseDays.length) incoming = [{ fromWeek: 1, toWeek: total, days: looseDays }];
  const blocks = [];
  for (const block of incoming.slice(0, 4)) {
    const listed = listedDays(block);
    const days = normalizeDays(listed.length ? listed : block?.days, catalog, count, true);
    if (!days.length) continue;
    const fromWeek = whole(block?.fromWeek, blocks.length ? blocks[blocks.length - 1].toWeek + 1 : 1, 1, total);
    const toWeek = whole(block?.toWeek, total, fromWeek, total);
    blocks.push({ fromWeek, toWeek, days });
  }
  if (!blocks.length) {
    return { name: "", summary: "", blocks: [], overTime: false };
  }
  blocks.sort((a, b) => a.fromWeek - b.fromWeek);
  blocks[0].fromWeek = 1;
  for (let i = 1; i < blocks.length; i += 1) {
    if (blocks[i].fromWeek <= blocks[i - 1].toWeek) blocks[i].fromWeek = Math.min(total, blocks[i - 1].toWeek + 1);
    if (blocks[i].toWeek < blocks[i].fromWeek) blocks[i].toWeek = blocks[i].fromWeek;
  }
  blocks[blocks.length - 1].toWeek = total;
  const budget = Math.max(Number(minutes) || 0, 1) * 60 * 1.15;
  const overTime = blocks.some((block) => block.days.some((day) => day.seconds > budget));
  return {
    name: String(source.name || "").trim().slice(0, 80),
    summary: String(source.summary || "").trim().slice(0, 280),
    blocks: blocks.filter((block) => block.fromWeek <= total),
    overTime,
  };
}

/** Copy a week pattern onto every training day. Later weeks add a little work, and every fourth week eases back. */
export function progressExercise(item, week, startWeek = 1) {
  const local = Math.max(Number(week) - Number(startWeek) + 1, 1);
  const step = Math.floor((local - 1) / 4);
  const deload = local % 4 === 0;
  const next = { ...item };
  if (deload || step === 0) return next;
  if (Number(next.durationSeconds) > 0) {
    next.durationSeconds = Math.min(3600, Number(next.durationSeconds) + step * 15);
  } else if (Number(next.reps) > 0) {
    next.reps = Math.min(30, Number(next.reps) + step);
  }
  return next;
}

export function expandSchedule(blocks, weeks, phases = []) {
  const total = whole(weeks, 1, 1, 24);
  const source = Array.isArray(blocks) ? blocks.filter((block) => block?.days?.length) : [];
  if (!source.length || !total) return [];
  const schedule = [];
  for (let week = 1; week <= total; week += 1) {
    const block =
      [...source].reverse().find((item) => week >= item.fromWeek && week <= item.toWeek) ||
      [...source].reverse().find((item) => item.fromWeek <= week) ||
      source[0];
    const phase = (phases || []).find((item) => week >= item.fromWeek && week <= item.toWeek);
    block.days.forEach((day, index) => {
      const exercises = day.exercises.map((item) => progressExercise(item, week, block.fromWeek));
      const label = String(day.name || `Day ${index + 1}`).trim();
      schedule.push({
        week,
        dayIndex: index + 1,
        name: `Week ${week} Day ${index + 1} · ${label}`.slice(0, 100),
        progression: phase?.change || "",
        exercises,
        seconds: sessionSeconds(exercises),
      });
    });
  }
  return schedule;
}

export function applyCatalogMatches(blocks, matches) {
  const byName = new Map();
  for (const item of matches || []) {
    if (!item?.exerciseId) continue;
    byName.set(String(item.name || "").trim().toLowerCase(), item);
  }
  return (blocks || []).map((block) => ({
    ...block,
    days: (block.days || []).map((day) => ({
      ...day,
      exercises: (day.exercises || []).map((exercise) => {
        if (exercise.matched) return exercise;
        const found = byName.get(String(exercise.name || "").trim().toLowerCase());
        if (!found) return exercise;
        return {
          ...exercise,
          exerciseId: found.exerciseId,
          name: found.matchedName || exercise.name,
          matched: true,
        };
      }),
    })),
  }));
}

export function collectAdditions(blocks) {
  const missing = [];
  for (const block of blocks || []) {
    for (const day of block.days || []) {
      for (const exercise of day.exercises || []) {
        if (exercise.matched) continue;
        missing.push({
          name: exercise.name,
          equipment: exercise.equipment,
          reason: exercise.notes,
          description: exercise.notes,
        });
      }
    }
  }
  return proposedAdditions({ missing });
}

function phaseLabel(fromWeek, toWeek) {
  return fromWeek === toWeek ? `Week ${fromWeek}` : `Weeks ${fromWeek}–${toWeek}`;
}

function defaultProgression(weeks) {
  const size = weeks <= 4 ? weeks : 4;
  const phases = [];
  for (let start = 1; start <= weeks; start += size) {
    const fromWeek = start;
    const toWeek = Math.min(weeks, start + size - 1);
    phases.push({
      fromWeek,
      toWeek,
      label: phaseLabel(fromWeek, toWeek),
      change:
        start === 1
          ? "Use the starting sets and reps. Stop a set when the last reps get sloppy."
          : "Add 1–2 reps, a little weight, or a little time when every set feels manageable.",
    });
  }
  return phases;
}

/** Phases cover week 1 through the end of the plan. Missing model text gets a simple load increase. */
export function normalizeProgression(raw, weeks) {
  const total = whole(weeks, 8, 1, 24);
  const source = raw && typeof raw === "object" && Array.isArray(raw.progression) ? raw.progression : [];
  const phases = [];
  for (const item of source.slice(0, 6)) {
    const change = String(item?.change || item?.note || "").trim().slice(0, 240);
    if (!change) continue;
    const fromWeek = whole(item?.fromWeek, phases.length ? phases[phases.length - 1].toWeek + 1 : 1, 1, total);
    const toWeek = whole(item?.toWeek, total, fromWeek, total);
    phases.push({ fromWeek, toWeek, change });
  }
  if (!phases.length) return defaultProgression(total);
  phases.sort((a, b) => a.fromWeek - b.fromWeek);
  phases[0].fromWeek = 1;
  phases[phases.length - 1].toWeek = total;
  return phases.map((phase) => ({ ...phase, label: phaseLabel(phase.fromWeek, phase.toWeek) }));
}

export function proposedAdditions(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const list = Array.isArray(source.missing) ? source.missing : [];
  const seen = new Set();
  const additions = [];
  for (const item of list) {
    const name = String(item?.name || "").trim().slice(0, 80);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    const equipment = EQUIPMENT_KEYS.has(String(item?.equipment || "")) ? String(item.equipment) : "body";
    additions.push({
      name,
      equipment,
      reason: String(item?.reason || "").trim().slice(0, 200),
      description: String(item?.description || "").trim().slice(0, 400),
    });
    if (additions.length >= 40) break;
  }
  return additions;
}

export function catalogNameMatch(name, rows) {
  const wanted = String(name || "").trim().toLowerCase();
  if (!wanted) return null;
  const list = rows || [];
  return (
    list.find((row) => String(row.name || "").trim().toLowerCase() === wanted) ||
    list.find((row) => {
      const current = String(row.name || "").trim().toLowerCase();
      return current.includes(wanted) || wanted.includes(current);
    }) ||
    null
  );
}

const DESCRIPTION_STOP = new Set([
  "week", "weeks", "month", "months", "day", "days", "with", "that", "this", "from", "your",
  "plan", "workout", "workouts", "exercise", "exercises", "minutes", "minute", "sets", "reps",
  "each", "session", "sessions", "about", "want", "have", "using", "into", "then", "than",
  "when", "every", "keep", "more", "some", "just", "like", "also", "will", "after", "before",
  "through", "upper", "lower", "full", "create", "mixes", "available", "along", "other",
  "suggestions", "reach", "focus", "attention", "because", "know", "what", "that", "include",
  "additional", "should", "less", "more", "second",
]);

const MOVEMENT_WORDS = new Set([
  "squat", "bench", "lunge", "plank", "push", "press", "pull", "row", "deadlift", "crunch",
  "burpee", "swing", "carry", "run", "jump", "hinge", "curl", "raise", "bridge", "dip",
  "pulldown", "kettlebell", "dumbbell", "thrust", "hollow", "pallof", "superman",
]);

function withoutAvoidClauses(text) {
  return String(text || "")
    .replace(/don'?t use\s+[^.!\n]+/gi, " ")
    .replace(/do not use\s+[^.!\n]+/gi, " ")
    .replace(/\bremove\s+[^.!\n]+/gi, " ");
}

function movementToken(word) {
  if (MOVEMENT_WORDS.has(word)) return word;
  const singular = word.endsWith("s") ? word.slice(0, -1) : "";
  if (singular && MOVEMENT_WORDS.has(singular)) return singular;
  return "";
}

/** Words from the plan description that can point at catalog exercise names. */
export function descriptionWords(text) {
  const words = withoutAvoidClauses(text).toLowerCase().match(/[a-z][a-z0-9'-]{3,}/g) || [];
  const movements = [];
  const rest = [];
  for (const word of words) {
    const movement = movementToken(word);
    if (movement) movements.push(movement);
    else if (!DESCRIPTION_STOP.has(word)) rest.push(word);
  }
  return [...new Set([...movements, ...rest])].slice(0, 12);
}

export function avoidTerms(text) {
  const found = [];
  const patterns = [
    /don'?t use\s+([a-z0-9][a-z0-9 ]{1,30}?)(?=\s+and\b|\s+because\b|[.!?]|$)/gi,
    /do not use\s+([a-z0-9][a-z0-9 ]{1,30}?)(?=\s+and\b|\s+because\b|[.!?]|$)/gi,
    /\bremove\s+([a-z0-9][a-z0-9 ]{1,30}?)(?=\s+because\b|[.!?]|$)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of String(text || "").matchAll(pattern)) {
      const term = match[1].trim().toLowerCase();
      if (term && !found.includes(term)) found.push(term);
    }
  }
  return found.slice(0, 8);
}

export function excludesAvoid(name, terms) {
  const text = String(name || "").toLowerCase();
  return (terms || []).some((term) => {
    const value = String(term || "").trim().toLowerCase();
    if (!value) return false;
    if (text.includes(value)) return true;
    const stem = value.endsWith("s") ? value.slice(0, -1) : "";
    return stem.length >= 3 && text.includes(stem);
  });
}

/** Schedule facts written in the description. Empty fields mean the description did not state them. */
export function scheduleFromDescription(text) {
  const raw = String(text || "");
  const result = { avoid: avoidTerms(raw) };
  const perWeek = raw.match(/(\d+)\s*(?:workouts|workout|sessions|session|days|day)\s*(?:per|a|each|\/)\s*week/i);
  if (perWeek) result.daysPerWeek = whole(perWeek[1], 0, 1, 5) || undefined;
  const range = raw.match(/less than\s*(\d+)\s*or more than\s*(\d+)\s*minutes/i)
    || raw.match(/(\d+)\s*(?:to|–|-)\s*(\d+)\s*minutes/i);
  if (range) {
    result.minuteFloor = whole(range[1], 0, 15, 90) || undefined;
    result.minutes = whole(range[2], 0, 15, 90) || undefined;
  } else {
    const one = raw.match(/(\d+)\s*minutes/i);
    if (one) result.minutes = whole(one[1], 0, 15, 90) || undefined;
  }
  const explicitWeeks = raw.match(/\b(\d+)\s*weeks?\b/i);
  const planDays = raw.match(/\b(\d+)\s*-?\s*day\s+plan\b/i) || raw.match(/\b(\d+)\s+plan\b/i);
  if (explicitWeeks) result.durationWeeks = whole(explicitWeeks[1], 0, 1, 16) || undefined;
  else if (planDays && result.daysPerWeek) {
    const total = Number(planDays[1]);
    if (total >= result.daysPerWeek && total % result.daysPerWeek === 0) {
      const weeks = total / result.daysPerWeek;
      if (weeks >= 1 && weeks <= 16) result.durationWeeks = weeks;
    }
  }
  if (/weight\s*loss/i.test(raw)) result.goal = "weight-loss";
  else if (/mixed goal/i.test(raw)) result.goal = "mixed";
  else if (/\bendurance\b/i.test(raw)) result.goal = "endurance";
  else if (/\bmobility\b/i.test(raw)) result.goal = "mobility";
  else if (/\bstrength\b/i.test(raw)) result.goal = "strength";
  return result;
}

function coversMove(exerciseName, moveName) {
  const text = String(exerciseName || "").toLowerCase();
  const words = String(moveName || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word && word !== "up");
  return words.length > 0 && words.every((word) => text.includes(word));
}

/** Counts written into the description, such as "50 push ups" on 3 of 5 days. */
export function prescribedMoves(text) {
  const raw = String(text || "");
  const onDays = whole((raw.match(/(\d+)\s+of\s+the\s+\d+/i) || [])[1], 0, 1, 5) || null;
  const moves = [];
  const seen = new Set();
  function add(move) {
    const key = move.name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    moves.push(move);
  }
  for (const match of raw.matchAll(/(\d+)\s*seconds?\s+(planks?)/gi)) {
    add({ name: "Plank", reps: null, durationSeconds: whole(match[1], 50, 1, 600) });
  }
  for (const match of raw.matchAll(/(\d+)\s*-?\s*(push(?:\s|-)?ups?|lunges?|plyo\s*-?\s*squats?)/gi)) {
    const label = match[2].toLowerCase();
    const count = whole(match[1], 0, 1, 100);
    if (/push/.test(label)) add({ name: "Push-up", reps: count, durationSeconds: null });
    else if (/lunge/.test(label)) add({ name: "Lunge", reps: count, durationSeconds: null });
    else if (/plyo/.test(label)) add({ name: "Plyo squat", reps: count, durationSeconds: null });
  }
  return { onDays, moves };
}

export function applyPrescriptions(blocks, prescription) {
  const moves = prescription?.moves || [];
  if (!moves.length) return blocks || [];
  const onDays = prescription.onDays || 0;
  return (blocks || []).map((block) => {
    const days = (block.days || []).map((day) => ({
      ...day,
      exercises: (day.exercises || []).map((exercise) => {
        const move = moves.find((item) => coversMove(exercise.name, item.name));
        if (!move) return exercise;
        if (move.durationSeconds) {
          return { ...exercise, sets: 1, reps: null, durationSeconds: move.durationSeconds };
        }
        return { ...exercise, sets: 1, reps: move.reps, durationSeconds: null };
      }),
    }));
    const hasAll = (day) => moves.every((move) => day.exercises.some((exercise) => coversMove(exercise.name, move.name)));
    let carrying = days.filter(hasAll).length;
    if (onDays) {
      for (const day of days) {
        if (carrying >= onDays || hasAll(day)) continue;
        for (const move of moves) {
          if (day.exercises.some((exercise) => coversMove(exercise.name, move.name))) continue;
          day.exercises.push({
            exerciseId: null,
            name: move.name,
            equipment: "body",
            matched: false,
            sets: 1,
            reps: move.durationSeconds ? null : move.reps,
            durationSeconds: move.durationSeconds,
            restSeconds: 60,
            notes: "",
          });
        }
        if (hasAll(day)) carrying += 1;
      }
    }
    return {
      ...block,
      days: days.map((day) => ({ ...day, seconds: sessionSeconds(day.exercises) })),
    };
  });
}

export function applyDescriptionSchedule(request) {
  const parsed = scheduleFromDescription(request?.description);
  const daysPerWeek = parsed.daysPerWeek || request.daysPerWeek;
  const durationWeeks = parsed.durationWeeks || request.durationWeeks;
  const minutes = parsed.minutes || request.minutes;
  const goal = parsed.goal || request.goal;
  const avoid = [request.avoid, ...(parsed.avoid || [])].filter(Boolean).join(", ").slice(0, 300);
  return {
    ...request,
    goal,
    daysPerWeek,
    minutes,
    minuteFloor: parsed.minuteFloor || null,
    durationUnit: parsed.durationWeeks ? "weeks" : request.durationUnit,
    durationCount: parsed.durationWeeks || request.durationCount,
    durationWeeks,
    durationLabel: parsed.durationWeeks ? `${durationWeeks} weeks` : request.durationLabel,
    scheduleDays: durationWeeks * daysPerWeek,
    avoid,
    avoidTerms: parsed.avoid || [],
  };
}

export function goalLabel(key) {
  return PLAN_GOALS.find((item) => item.key === key)?.label || "Mixed";
}

export function parsePlanRequest(body) {
  const raw = body && typeof body === "object" ? body : {};
  const goal = PLAN_GOALS.some((item) => item.key === raw.goal) ? raw.goal : "mixed";
  const daysPerWeek = whole(raw.daysPerWeek, 3, 1, 5);
  const minutes = whole(raw.minutes, 45, 15, 90);
  const durationUnit = raw.durationUnit === "months" ? "months" : "weeks";
  const durationCount = whole(raw.durationCount, durationUnit === "months" ? 2 : 8, 1, durationUnit === "months" ? 6 : 16);
  const durationWeeks = durationUnit === "months" ? durationCount * 4 : durationCount;
  const equipment = [...new Set((Array.isArray(raw.equipment) ? raw.equipment : ["body"]).map(String))]
    .filter((key) => EQUIPMENT_KEYS.has(key));
  return {
    goal,
    daysPerWeek,
    minutes,
    durationUnit,
    durationCount,
    durationWeeks,
    durationLabel: durationUnit === "months" ? `${durationCount} months` : `${durationCount} weeks`,
    equipment: equipment.length ? equipment : ["body"],
    avoid: String(raw.avoid || "").trim().slice(0, 300),
    description: String(raw.description || "").trim().slice(0, 2000),
    scheduleDays: durationWeeks * daysPerWeek,
  };
}
