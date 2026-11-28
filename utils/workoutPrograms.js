const WEEK_DAY = /Week\s+([1-9]\d*)\s+Day\s+([1-9]\d*)/i;
const TITLE_WEEK = /^(.*?)\s·\s+Week\s+[1-9]\d*\s+Day\s+[1-9]\d*/i;

/**
 * Program names match workout names: required, trimmed, at most 120 characters.
 * Returns a result so callers outside the server can stay free of HTTP errors.
 */
export function parseProgramName(value) {
  const name = String(value ?? "").trim();
  if (!name) return { ok: false, error: "Program name is required." };
  if (name.length > 120) return { ok: false, error: "Program name must be 120 characters or fewer." };
  return { ok: true, name };
}

/** Descriptions match workout notes: blank becomes null, and the rest is capped at 2000. */
export function parseProgramDescription(value) {
  if (value == null) return null;
  const description = String(value).trim();
  return description ? description.slice(0, 2000) : null;
}

/** Week and day parsed from a workout name, or null when the name has no Week N Day D. */
export function parseWeekDay(name) {
  const match = WEEK_DAY.exec(String(name ?? ""));
  if (!match) return null;
  return { week: Number(match[1]), day: Number(match[2]) };
}

/**
 * Shared title before " · Week N". Plan saves look like
 * "Title · Week 1 Day 1 · Day 1" or "Title plan · Week 16 Day 5 · Day 5".
 */
export function planNamePrefix(name) {
  const match = TITLE_WEEK.exec(String(name ?? ""));
  if (!match) return null;
  const prefix = match[1].trim();
  return prefix || null;
}

/**
 * Link order inside one program. Week/day names sort as week * 100 + day.
 * Anything else is appended after the sort orders already in that program.
 */
export function defaultLinkSortOrder(name, existingSortOrders = []) {
  const parsed = parseWeekDay(name);
  if (parsed) return parsed.week * 100 + parsed.day;
  const numbers = (existingSortOrders || []).map(Number).filter((value) => Number.isFinite(value));
  const max = numbers.length ? Math.max(...numbers) : -1;
  return max + 1;
}

/** Assign sort orders for a batch of new links, in request order. Already-linked ids are the caller's job. */
export function assignLinkSortOrders(items, existingSortOrders = []) {
  const used = (existingSortOrders || []).map(Number).filter((value) => Number.isFinite(value));
  return (items || []).map((item) => {
    const sortOrder = defaultLinkSortOrder(item.name, used);
    used.push(sortOrder);
    return { workoutId: item.workoutId, sortOrder };
  });
}

/**
 * Place each workout under every program it belongs to.
 * A workout with no memberships is Unassigned. The same workout can appear
 * under more than one program. `programs` supplies list order; memberships
 * on the workouts fill in any program that list omitted.
 */
export function groupWorkouts(workouts, programs = []) {
  const buckets = new Map();
  for (const program of programs || []) {
    buckets.set(program.programId, {
      programId: program.programId,
      name: program.name,
      sortOrder: program.sortOrder ?? 0,
      workouts: [],
    });
  }
  const unassigned = [];
  for (const workout of workouts || []) {
    const memberships = Array.isArray(workout.programs) ? workout.programs : [];
    if (!memberships.length) {
      unassigned.push(workout);
      continue;
    }
    for (const membership of memberships) {
      let bucket = buckets.get(membership.programId);
      if (!bucket) {
        bucket = {
          programId: membership.programId,
          name: membership.name,
          sortOrder: membership.sortOrder ?? 0,
          workouts: [],
        };
        buckets.set(membership.programId, bucket);
      }
      bucket.workouts.push(workout);
    }
  }
  return { programs: [...buckets.values()], unassigned };
}

/** Group one program's workouts under Week N headings. Names without the pattern stay in `other`. */
export function groupProgramWorkouts(workouts) {
  const weeks = new Map();
  const other = [];
  for (const workout of workouts || []) {
    const parsed = parseWeekDay(workout.name);
    if (!parsed) {
      other.push(workout);
      continue;
    }
    if (!weeks.has(parsed.week)) weeks.set(parsed.week, []);
    weeks.get(parsed.week).push(workout);
  }
  const byOrder = (left, right) =>
    (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.workoutId - right.workoutId;
  const weekGroups = [...weeks.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([week, items]) => ({ week, workouts: [...items].sort(byOrder) }));
  return { weekGroups, other: [...other].sort(byOrder), grouped: weekGroups.length > 0 };
}

/** Week/Day workouts in an Unassigned list, split by the shared title prefix. */
export function weekDayGroups(workouts) {
  const groups = new Map();
  for (const workout of workouts || []) {
    const parsed = parseWeekDay(workout.name);
    if (!parsed) continue;
    const prefix = planNamePrefix(workout.name) || "";
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix).push({ ...workout, week: parsed.week, day: parsed.day });
  }
  return [...groups.entries()].map(([prefix, items]) => {
    const weeks = items.map((item) => item.week);
    return {
      prefix,
      workoutIds: items.map((item) => item.workoutId),
      count: items.length,
      weekMin: Math.min(...weeks),
      weekMax: Math.max(...weeks),
    };
  });
}

/** Preview for bulk add: how many workouts, the week range, and the shared title when there is one. */
export function bundlePreview(workouts, selectedIds) {
  const wanted = new Set(selectedIds || []);
  const selected = (workouts || []).filter((workout) => wanted.has(workout.workoutId));
  const parsed = selected
    .map((workout) => ({ workout, weekDay: parseWeekDay(workout.name) }))
    .filter((item) => item.weekDay);
  const titles = [...new Set(parsed.map((item) => planNamePrefix(item.workout.name)).filter(Boolean))];
  const weeks = parsed.map((item) => item.weekDay.week);
  return {
    count: selected.length,
    weekMin: weeks.length ? Math.min(...weeks) : null,
    weekMax: weeks.length ? Math.max(...weeks) : null,
    sharedTitle: titles.length === 1 ? titles[0] : null,
    titles,
  };
}

/** Journal sections. A workout is repeated under each program. Unassigned is last, and hidden when empty. */
export function journalSections(workouts) {
  const grouped = groupWorkouts(workouts);
  const programs = grouped.programs
    .filter((program) => program.workouts.length)
    .map((program) => ({
      key: `program-${program.programId}`,
      title: program.name,
      workouts: [...program.workouts].sort((left, right) => {
        const leftOrder = membershipSort(left, program.programId);
        const rightOrder = membershipSort(right, program.programId);
        return leftOrder - rightOrder || left.workoutId - right.workoutId;
      }),
    }))
    .sort((left, right) => left.title.localeCompare(right.title));
  if (!programs.length) {
    return grouped.unassigned.length ? [{ key: "all", title: "", workouts: grouped.unassigned }] : [];
  }
  if (grouped.unassigned.length) {
    programs.push({ key: "unassigned", title: "Unassigned", workouts: grouped.unassigned });
  }
  return programs;
}

function membershipSort(workout, programId) {
  const membership = (workout.programs || []).find((item) => item.programId === programId);
  return membership?.sortOrder ?? 0;
}

/** Next free program name. "Title" becomes "Title (2)" when that user already has Title. */
export function disambiguateProgramName(name, existingNames) {
  const base = String(name ?? "").trim() || "Workout plan";
  const taken = new Set((existingNames || []).map((item) => String(item ?? "").trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base.slice(0, 120);
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base} (${index})`.slice(0, 120);
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} (${existingNames.length + 1})`.slice(0, 120);
}
