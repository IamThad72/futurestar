import {
  DEFAULT_STRENGTH_BENEFITS,
  DEFAULT_STRENGTH_PROGRAM,
  EXERCISE_DB_EQUIPMENT_BY_KEY,
  FEATURED_EXERCISE_DB_IDS,
  FEATURED_EXERCISE_DB_NAMES,
  STRENGTH_EQUIPMENT_KEYS,
  STRENGTH_EXERCISES,
  equipmentKeyFromDb,
  isPullingExercise,
  usesBandEquipment,
} from "~/utils/strengthExercises";
import {
  DEFAULT_ENDURANCE_BENEFITS,
  ENDURANCE_EQUIPMENT_KEYS,
  ENDURANCE_EXERCISES,
  FEATURED_ENDURANCE_DB_IDS,
  FEATURED_ENDURANCE_DB_NAMES,
  LOCAL_FEATURED_ENDURANCE_IDS,
  enduranceEquipmentKeyFromDb,
  enduranceProgramFor,
  isAerobicExercise,
  isAerobicExtraExercise,
  isJunkEnduranceName,
  isOfficialCardioExercise,
} from "~/utils/enduranceExercises";
import {
  DEFAULT_FLEXIBILITY_BENEFITS,
  DEFAULT_PLYOMETRIC_BENEFITS,
  FEATURED_FLEXIBILITY_DB_IDS,
  FEATURED_FLEXIBILITY_DB_NAMES,
  FLEXIBILITY_EXERCISES,
  FLEXIBILITY_FILTER_KEYS,
  FLEXIBILITY_REGION_KEYS,
  flexibilityEquipmentKeyFromDb,
  flexibilityProgramFor,
  flexibilityRegionFromDb,
  isFlexibilityExercise,
  isPlyometricExercise,
  isStretchExercise,
  isYogaExercise,
} from "~/utils/flexibilityExercises";
import {
  displayExerciseName,
  exerciseGifUrl,
  fetchExerciseDbById,
  fetchExerciseDbPage,
  getExerciseDbSource,
  isExerciseDbRateLimit,
  normalizeExercise,
  type ExerciseDbRaw,
} from "./exerciseDb";

type DbClient = {
  query: (queryText: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
};

export type StrengthEquipmentKey = "dumbbell" | "kettlebell" | "body";
export type EnduranceEquipmentKey = "outdoor" | "body" | "dumbbell" | "kettlebell" | "machine" | "rope";
export type FlexibilityEquipmentKey = "body" | "roller" | "assisted" | "ball" | "rope" | "dumbbell" | "kettlebell";
export type FlexibilityRegionKey = "hips" | "back" | "shoulders" | "legs" | "neck" | "plyo";
export type CatalogEquipmentKey =
  | StrengthEquipmentKey
  | EnduranceEquipmentKey
  | FlexibilityEquipmentKey
  | "weighted"
  | "stick";

export type StrengthExerciseDto = {
  id: string;
  exerciseId: string | null;
  featured: boolean;
  name: string;
  equipment: CatalogEquipmentKey;
  description: string;
  instructions: string[];
  benefits: string[];
  sets: string;
  repetitions: string;
  rest: string;
  gifUrl: string | null;
  targetMuscles: string[];
  bodyParts: string[];
  secondaryMuscles: string[];
  region?: FlexibilityRegionKey;
};

type CatalogRow = {
  exercise_id: string;
  name: string;
  gif_url: string | null;
  overview: string | null;
  body_parts: unknown;
  target_muscles: unknown;
  secondary_muscles: unknown;
  equipments: unknown;
  instructions: unknown;
  exercise_types: unknown;
  difficulty: string | null;
  equipment_key: CatalogEquipmentKey | null;
  source: string;
};

const featuredDbIds = FEATURED_EXERCISE_DB_IDS as Record<string, string>;
const featuredDbNames = FEATURED_EXERCISE_DB_NAMES as Record<string, string[]>;

const featuredEnduranceDbIds = FEATURED_ENDURANCE_DB_IDS as Record<string, string>;
const featuredEnduranceDbNames = FEATURED_ENDURANCE_DB_NAMES as Record<string, string[]>;

const featuredFlexibilityDbIds = FEATURED_FLEXIBILITY_DB_IDS as Record<string, string>;
const featuredFlexibilityDbNames = FEATURED_FLEXIBILITY_DB_NAMES as Record<string, string[]>;

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return [];
}

function visibleMuscles(value: unknown): string[] {
  return asStringArray(value).filter((item) => item.toLowerCase() !== "cardiovascular system");
}

function normalizeName(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function programFor(equipment: StrengthEquipmentKey) {
  return DEFAULT_STRENGTH_PROGRAM[equipment] || DEFAULT_STRENGTH_PROGRAM.body;
}

function descriptionFromCatalog(row: CatalogRow) {
  const overview = String(row.overview || "").trim();
  if (overview) return overview;
  const muscles = asStringArray(row.target_muscles);
  if (muscles.length) return `Works the ${muscles.join(", ")}.`;
  const parts = asStringArray(row.body_parts);
  if (parts.length) return `Targets the ${parts.join(", ")}.`;
  return "A strength exercise from the ExerciseDB catalog.";
}

function catalogToDto(row: CatalogRow): StrengthExerciseDto | null {
  const equipment = (row.equipment_key || equipmentKeyFromDb(asStringArray(row.equipments))) as StrengthEquipmentKey | null;
  if (!equipment || !STRENGTH_EQUIPMENT_KEYS.includes(equipment)) return null;
  const bodyParts = asStringArray(row.body_parts);
  if (bodyParts.includes("cardio")) return null;
  if (usesBandEquipment(asStringArray(row.equipments), row.name)) return null;
  if (
    !isPullingExercise({
      name: row.name,
      targetMuscles: asStringArray(row.target_muscles),
      bodyParts,
      equipments: asStringArray(row.equipments),
    })
  ) {
    return null;
  }
  const program = programFor(equipment);
  return {
    id: row.exercise_id,
    exerciseId: row.exercise_id,
    featured: false,
    name: displayExerciseName(row.name),
    equipment,
    description: descriptionFromCatalog(row),
    instructions: asStringArray(row.instructions),
    benefits: [...DEFAULT_STRENGTH_BENEFITS],
    sets: program.sets,
    repetitions: program.repetitions,
    rest: program.rest,
    gifUrl: exerciseGifUrl(row.exercise_id, row.gif_url),
    targetMuscles: visibleMuscles(row.target_muscles),
    bodyParts: asStringArray(row.body_parts),
    secondaryMuscles: visibleMuscles(row.secondary_muscles),
  };
}

function featuredToDto(exercise: (typeof STRENGTH_EXERCISES)[number], match: CatalogRow | null): StrengthExerciseDto {
  const knownId = featuredDbIds[exercise.id] || null;
  const trustedMatch = match && gifMatchesFeatured(exercise, match) ? match : null;
  const gifUrl = exerciseGifUrl(trustedMatch?.exercise_id || knownId, trustedMatch?.gif_url);
  return {
    id: exercise.id,
    exerciseId: trustedMatch?.exercise_id || knownId,
    featured: true,
    name: exercise.name,
    equipment: exercise.equipment as StrengthEquipmentKey,
    description: exercise.description,
    instructions: exercise.instructions,
    benefits: exercise.benefits,
    sets: exercise.sets,
    repetitions: exercise.repetitions,
    rest: exercise.rest,
    gifUrl,
    targetMuscles: trustedMatch ? visibleMuscles(trustedMatch.target_muscles) : [],
    bodyParts: trustedMatch ? asStringArray(trustedMatch.body_parts) : [],
    secondaryMuscles: trustedMatch ? visibleMuscles(trustedMatch.secondary_muscles) : [],
  };
}

function stripEquipmentPrefix(value: string) {
  return normalizeName(value).replace(
    /^(dumbbell|barbell|band|resistance band|body ?weight|kettlebell)\s+/,
    "",
  );
}

function scoreNameMatch(candidate: string, targets: string[]) {
  const a = stripEquipmentPrefix(candidate);
  let best = 0;
  for (const target of targets) {
    const b = stripEquipmentPrefix(target);
    if (!a || !b) continue;
    if (a === b) best = Math.max(best, 100);
  }
  return best;
}

function gifMatchesFeatured(
  exercise: (typeof STRENGTH_EXERCISES)[number],
  row: CatalogRow | null,
) {
  if (!row) return false;
  if (row.equipment_key && row.equipment_key !== exercise.equipment) return false;
  const wantedId = featuredDbIds[exercise.id];
  if (wantedId && row.exercise_id === wantedId) return true;
  return scoreNameMatch(row.name, [exercise.name, ...(featuredDbNames[exercise.id] || [])]) === 100;
}

async function upsertExercises(
  client: DbClient,
  items: ExerciseDbRaw[],
  source: string,
  mapEquipment: (equipments: string[], _name?: string) => string | null = equipmentKeyFromDb,
) {
  const now = new Date().toISOString();
  for (const raw of items) {
    const exercise = normalizeExercise(raw);
    if (!exercise.exerciseId || !exercise.name) continue;
    const equipmentKey = mapEquipment(exercise.equipments, exercise.name);
    if (!equipmentKey) continue;
    await client.query(
      `INSERT INTO exercise_catalog (
         exercise_id, name, gif_url, overview, body_parts, target_muscles, secondary_muscles,
         equipments, instructions, exercise_types, difficulty, equipment_key, source, fetched_at
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,$14)
       ON CONFLICT (exercise_id) DO UPDATE SET
         name = EXCLUDED.name,
         gif_url = COALESCE(EXCLUDED.gif_url, exercise_catalog.gif_url),
         overview = COALESCE(EXCLUDED.overview, exercise_catalog.overview),
         body_parts = EXCLUDED.body_parts,
         target_muscles = EXCLUDED.target_muscles,
         secondary_muscles = EXCLUDED.secondary_muscles,
         equipments = EXCLUDED.equipments,
         instructions = EXCLUDED.instructions,
         exercise_types = EXCLUDED.exercise_types,
         difficulty = COALESCE(EXCLUDED.difficulty, exercise_catalog.difficulty),
         equipment_key = EXCLUDED.equipment_key,
         source = EXCLUDED.source,
         fetched_at = EXCLUDED.fetched_at`,
      [
        exercise.exerciseId,
        exercise.name,
        exercise.gifUrl,
        exercise.overview,
        JSON.stringify(exercise.bodyParts),
        JSON.stringify(exercise.targetMuscles),
        JSON.stringify(exercise.secondaryMuscles),
        JSON.stringify(exercise.equipments),
        JSON.stringify(exercise.instructions),
        JSON.stringify(exercise.exerciseTypes),
        exercise.difficulty,
        equipmentKey,
        source,
        now,
      ],
    );
  }
}

async function getSyncRow(client: DbClient, equipmentName: string) {
  const result = await client.query(
    `SELECT equipment_name, next_cursor, complete, item_count, synced_at
     FROM exercise_catalog_sync WHERE equipment_name = $1`,
    [equipmentName],
  );
  return result.rows[0] || null;
}

async function countCached(client: DbClient, equipmentKey: StrengthEquipmentKey) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS n FROM exercise_catalog WHERE equipment_key = $1`,
    [equipmentKey],
  );
  return Number(result.rows[0]?.n || 0);
}

function equipmentNamesForFilter(equipment: string) {
  if (equipment && equipment !== "all" && equipment in EXERCISE_DB_EQUIPMENT_BY_KEY) {
    return EXERCISE_DB_EQUIPMENT_BY_KEY[equipment as StrengthEquipmentKey];
  }
  return Object.values(EXERCISE_DB_EQUIPMENT_BY_KEY).flat();
}

const REFRESH_COOLDOWN_MS = 60 * 1000;

function recentlySynced(syncedAt: unknown) {
  if (!syncedAt) return false;
  const time = new Date(String(syncedAt)).getTime();
  return Number.isFinite(time) && Date.now() - time < REFRESH_COOLDOWN_MS;
}

async function ensureCatalogWarm(client: DbClient, equipment: string) {
  const names = equipmentNamesForFilter(equipment);
  let fetched = false;

  for (const name of names) {
    const sync = await getSyncRow(client, name);
    if (sync?.complete) continue;
    if (recentlySynced(sync?.synced_at)) continue;
    try {
      const page = await fetchExerciseDbPage({
        equipments: name,
        after: sync?.next_cursor || null,
        limit: 25,
      });
      await upsertExercises(client, page.items, page.source);
      fetched = true;
      const equipmentKey = equipmentKeyFromDb([name]);
      const itemCount = equipmentKey ? await countCached(client, equipmentKey) : 0;
      await client.query(
        `INSERT INTO exercise_catalog_sync (equipment_name, next_cursor, complete, item_count, synced_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (equipment_name) DO UPDATE SET
           next_cursor = EXCLUDED.next_cursor,
           complete = EXCLUDED.complete,
           item_count = EXCLUDED.item_count,
           synced_at = NOW()`,
        [name, page.hasNextPage ? page.nextCursor : null, !page.hasNextPage, itemCount],
      );
      break;
    } catch (error) {
      if (isExerciseDbRateLimit(error)) break;
      throw error;
    }
  }

  return { warning: null as string | null, fetched };
}

async function loadCatalogRows(client: DbClient, ids: string[]) {
  if (!ids.length) return [] as CatalogRow[];
  const result = await client.query(
    `SELECT exercise_id, name, gif_url, overview, body_parts, target_muscles, secondary_muscles,
            equipments, instructions, exercise_types, difficulty, equipment_key, source
     FROM exercise_catalog WHERE exercise_id = ANY($1::text[])`,
    [ids],
  );
  return result.rows as CatalogRow[];
}

async function hydrateFeaturedIds(client: DbClient) {
  const missing = Object.entries(featuredDbIds);
  const ids = missing.map(([, id]) => id);
  const existing = await loadCatalogRows(client, ids);
  const have = new Set(existing.map((row) => row.exercise_id));
  for (const [, exerciseId] of missing) {
    if (have.has(exerciseId)) continue;
    try {
      const fetched = await fetchExerciseDbById(exerciseId);
      if (fetched?.item) await upsertExercises(client, [fetched.item], fetched.source);
    } catch (error) {
      if (isExerciseDbRateLimit(error)) break;
    }
  }
}

function pickFeaturedMatch(exercise: (typeof STRENGTH_EXERCISES)[number], rows: CatalogRow[]) {
  const wantedId = featuredDbIds[exercise.id];
  if (wantedId) {
    const exact = rows.find((row) => row.exercise_id === wantedId);
    if (exact) return exact;
  }
  const aliases = [exercise.name, ...(featuredDbNames[exercise.id] || [])];
  let best: CatalogRow | null = null;
  let bestScore = 0;
  for (const row of rows) {
    if (row.equipment_key && row.equipment_key !== exercise.equipment) continue;
    const score = scoreNameMatch(row.name, aliases);
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return gifMatchesFeatured(exercise, best) ? best : null;
}

async function listFeatured(client: DbClient, equipment: string, hydrate: boolean): Promise<StrengthExerciseDto[]> {
  if (hydrate) await hydrateFeaturedIds(client).catch(() => undefined);
  const knownIds = Object.values(featuredDbIds);
  const byId = await loadCatalogRows(client, knownIds);
  const byEquipment = await client.query(
    `SELECT exercise_id, name, gif_url, overview, body_parts, target_muscles, secondary_muscles,
            equipments, instructions, exercise_types, difficulty, equipment_key, source
     FROM exercise_catalog
     WHERE equipment_key = ANY($1::text[])`,
    [
      equipment && equipment !== "all"
        ? [equipment]
        : [...STRENGTH_EQUIPMENT_KEYS],
    ],
  );
  const rows = [...byId, ...(byEquipment.rows as CatalogRow[])];
  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    if (seen.has(row.exercise_id)) return false;
    seen.add(row.exercise_id);
    return true;
  });

  return STRENGTH_EXERCISES.filter((exercise) => {
    if (!equipment || equipment === "all") return true;
    return exercise.equipment === equipment;
  }).map((exercise) => featuredToDto(exercise, pickFeaturedMatch(exercise, unique)));
}

export async function listStrengthExercises(
  client: DbClient,
  options: { equipment?: string; q?: string; offset?: number; limit?: number },
) {
  const equipment = String(options.equipment || "all").trim() || "all";
  const q = String(options.q || "").trim();
  const offset = Math.max(Number(options.offset) || 0, 0);
  const limit = Math.min(Math.max(Number(options.limit) || 24, 1), 60);
  const warmed = await ensureCatalogWarm(client, equipment);
  let warning = warmed.warning;
  const featured = await listFeatured(client, equipment, false);
  const featuredIds = new Set(featured.map((item) => item.exerciseId).filter(Boolean));

  const queryCatalog = async () => {
    const params: unknown[] = [];
    const where = [
      "equipment_key IS NOT NULL",
      `NOT (body_parts ? 'cardio')`,
      `(
        lower(name) ~ '(row|pull|chin[- ]?up|pulldown|pullover|curl|shrug|inverted|face pull|high pull|gorilla)'
        OR lower(target_muscles::text) ~ '(lats|biceps|traps|rhomboids|upper back|rear deltoid)'
      )`,
      `lower(name) !~ '(press|push-up|push up|squat|lunge|bench|flye|crunch|plank|dip|burpee|calf|deadlift|pallof|bridge|carry|walk|jump|stretch|wrist|cable|yoga|asana|\\ypose\\y|facing dog|\\ysphinx\\y)'`,
      `NOT (equipments ? 'band')`,
      `NOT (equipments ? 'resistance band')`,
      `lower(name) NOT LIKE '%band%'`,
    ];
    if (equipment !== "all") {
      params.push(equipment);
      where.push(`equipment_key = $${params.length}`);
    } else {
      params.push([...STRENGTH_EQUIPMENT_KEYS]);
      where.push(`equipment_key = ANY($${params.length}::text[])`);
    }
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where.push(
        `(lower(name) LIKE $${params.length} OR lower(target_muscles::text) LIKE $${params.length} OR lower(body_parts::text) LIKE $${params.length})`,
      );
    }
    if (featuredIds.size) {
      params.push([...featuredIds]);
      where.push(`NOT (exercise_id = ANY($${params.length}::text[]))`);
    }

    const whereSql = where.join(" AND ");
    const countResult = await client.query(
      `SELECT COUNT(*)::int AS n FROM exercise_catalog WHERE ${whereSql}`,
      params,
    );
    const listParams = [...params, limit, offset];
    const listResult = await client.query(
      `SELECT exercise_id, name, gif_url, overview, body_parts, target_muscles, secondary_muscles,
              equipments, instructions, exercise_types, difficulty, equipment_key, source
       FROM exercise_catalog
       WHERE ${whereSql}
       ORDER BY lower(name) ASC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );
    return {
      total: Number(countResult.rows[0]?.n || 0),
      catalog: (listResult.rows as CatalogRow[])
        .map((row) => catalogToDto(row))
        .filter((item): item is StrengthExerciseDto => Boolean(item)),
    };
  };

  let { catalog, total } = await queryCatalog();
  if (q && total === 0 && !warmed.fetched) {
    try {
      const page = await fetchExerciseDbPage({ name: q, limit: 25 });
      await upsertExercises(client, page.items, page.source);
      ({ catalog, total } = await queryCatalog());
    } catch (error) {
      if (!warning && isExerciseDbRateLimit(error)) {
        warning = "Showing saved exercises. The live catalog could not be searched yet.";
      }
    }
  }
  return {
    source: getExerciseDbSource(),
    warning,
    featured: q
      ? featured.filter((item) => {
          const blob = `${item.name} ${item.targetMuscles.join(" ")} ${item.bodyParts.join(" ")}`.toLowerCase();
          return blob.includes(q.toLowerCase());
        })
      : featured,
    catalog: {
      items: catalog,
      total,
      limit,
      offset,
      hasMore: offset + catalog.length < total,
    },
    attribution: {
      required: true,
      text: "Exercise names, instructions, and GIFs from ExerciseDB by AscendAPI.",
      url: "https://ascendapi.com",
    },
  };
}

const CARDIO_SYNC_KEY = "cardio";

async function countCardio(client: DbClient) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS n FROM exercise_catalog WHERE body_parts ? 'cardio'`,
  );
  return Number(result.rows[0]?.n || 0);
}

async function ensureCardioWarm(client: DbClient) {
  const sync = await getSyncRow(client, CARDIO_SYNC_KEY);
  if (sync?.complete) return { warning: null as string | null, fetched: false };
  if (recentlySynced(sync?.synced_at)) return { warning: null as string | null, fetched: false };
  try {
    const page = await fetchExerciseDbPage({
      bodyParts: "cardio",
      after: sync?.next_cursor || null,
      limit: 25,
    });
    await upsertExercises(client, page.items, page.source, enduranceEquipmentKeyFromDb);
    const itemCount = await countCardio(client);
    await client.query(
      `INSERT INTO exercise_catalog_sync (equipment_name, next_cursor, complete, item_count, synced_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (equipment_name) DO UPDATE SET
         next_cursor = EXCLUDED.next_cursor,
         complete = EXCLUDED.complete,
         item_count = EXCLUDED.item_count,
         synced_at = NOW()`,
      [CARDIO_SYNC_KEY, page.hasNextPage ? page.nextCursor : null, !page.hasNextPage, itemCount],
    );
    return { warning: null as string | null, fetched: true };
  } catch (error) {
    if (isExerciseDbRateLimit(error)) return { warning: null as string | null, fetched: false };
    throw error;
  }
}

function enduranceDescription(row: CatalogRow) {
  const overview = String(row.overview || "").trim();
  if (overview) return overview;
  const muscles = visibleMuscles(row.secondary_muscles);
  if (muscles.length) return `A cardio move that also works the ${muscles.join(", ")}.`;
  return "A cardio exercise from the ExerciseDB catalog.";
}

function enduranceCatalogToDto(row: CatalogRow): StrengthExerciseDto | null {
  if (
    !isAerobicExercise({
      name: row.name,
      bodyParts: asStringArray(row.body_parts),
      targetMuscles: asStringArray(row.target_muscles),
      equipments: asStringArray(row.equipments),
    })
  ) {
    return null;
  }
  if (isJunkEnduranceName(row.name)) return null;
  const equipment = enduranceEquipmentKeyFromDb(asStringArray(row.equipments), row.name) as EnduranceEquipmentKey;
  if (!ENDURANCE_EQUIPMENT_KEYS.includes(equipment)) return null;
  const program = enduranceProgramFor(equipment, row.name);
  return {
    id: row.exercise_id,
    exerciseId: row.exercise_id,
    featured: false,
    name: displayExerciseName(row.name),
    equipment,
    description: enduranceDescription(row),
    instructions: asStringArray(row.instructions),
    benefits: [...DEFAULT_ENDURANCE_BENEFITS],
    sets: program.sets,
    repetitions: program.repetitions,
    rest: program.rest,
    gifUrl: exerciseGifUrl(row.exercise_id, row.gif_url),
    targetMuscles: visibleMuscles(row.target_muscles),
    bodyParts: asStringArray(row.body_parts),
    secondaryMuscles: visibleMuscles(row.secondary_muscles),
  };
}

function enduranceFeaturedToDto(
  exercise: (typeof ENDURANCE_EXERCISES)[number],
  match: CatalogRow | null,
): StrengthExerciseDto {
  const knownId = featuredEnduranceDbIds[exercise.id] || null;
  const trustedMatch = knownId && match && enduranceGifMatches(exercise, match) ? match : null;
  const catalogId = trustedMatch?.exercise_id || knownId || exercise.id;
  const gifUrl = knownId
    ? exerciseGifUrl(trustedMatch?.exercise_id || knownId, trustedMatch?.gif_url)
    : null;
  return {
    id: exercise.id,
    exerciseId: catalogId,
    featured: true,
    name: exercise.name,
    equipment: exercise.equipment as EnduranceEquipmentKey,
    description: exercise.description,
    instructions: exercise.instructions,
    benefits: exercise.benefits,
    sets: exercise.sets,
    repetitions: exercise.repetitions,
    rest: exercise.rest,
    gifUrl,
    targetMuscles: trustedMatch ? visibleMuscles(trustedMatch.target_muscles) : [],
    bodyParts: trustedMatch ? asStringArray(trustedMatch.body_parts) : [],
    secondaryMuscles: trustedMatch ? visibleMuscles(trustedMatch.secondary_muscles) : [],
  };
}

function enduranceGifMatches(
  exercise: (typeof ENDURANCE_EXERCISES)[number],
  row: CatalogRow | null,
) {
  if (!row) return false;
  const wantedId = featuredEnduranceDbIds[exercise.id];
  if (wantedId && row.exercise_id === wantedId) return true;
  return scoreNameMatch(row.name, [exercise.name, ...(featuredEnduranceDbNames[exercise.id] || [])]) === 100;
}

function pickEnduranceFeaturedMatch(exercise: (typeof ENDURANCE_EXERCISES)[number], rows: CatalogRow[]) {
  const wantedId = featuredEnduranceDbIds[exercise.id];
  if (wantedId) {
    const exact = rows.find((row) => row.exercise_id === wantedId);
    if (exact) return exact;
  }
  const aliases = [exercise.name, ...(featuredEnduranceDbNames[exercise.id] || [])];
  let best: CatalogRow | null = null;
  let bestScore = 0;
  for (const row of rows) {
    const score = scoreNameMatch(row.name, aliases);
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return enduranceGifMatches(exercise, best) ? best : null;
}

function matchesEnduranceKind(
  exercise: { name: string; bodyParts?: string[]; targetMuscles?: string[]; equipment?: string },
  kind: string,
) {
  if (!kind || kind === "all") return true;
  const payload = {
    name: exercise.name,
    bodyParts: exercise.bodyParts || [],
    targetMuscles: exercise.targetMuscles || [],
    equipment: exercise.equipment || "",
  };
  if (kind === "cardio") return isOfficialCardioExercise(payload);
  if (kind === "aerobic") return isAerobicExtraExercise(payload);
  return true;
}

export async function ensureLocalFeaturedEndurance(client: DbClient) {
  const now = new Date().toISOString();
  for (const exercise of ENDURANCE_EXERCISES) {
    if (!LOCAL_FEATURED_ENDURANCE_IDS.includes(exercise.id)) continue;
    await client.query(
      `INSERT INTO exercise_catalog (
         exercise_id, name, gif_url, overview, body_parts, target_muscles, secondary_muscles,
         equipments, instructions, exercise_types, difficulty, equipment_key, source, fetched_at
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,$14)
       ON CONFLICT (exercise_id) DO UPDATE SET
         name = EXCLUDED.name,
         overview = EXCLUDED.overview,
         instructions = EXCLUDED.instructions,
         equipment_key = EXCLUDED.equipment_key,
         body_parts = EXCLUDED.body_parts`,
      [
        exercise.id,
        exercise.name,
        null,
        exercise.description,
        JSON.stringify(["cardio"]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify(["body weight"]),
        JSON.stringify(exercise.instructions),
        JSON.stringify(["cardio"]),
        null,
        exercise.equipment,
        "local_featured",
        now,
      ],
    );
  }
}

async function listEnduranceFeatured(
  client: DbClient,
  equipment: string,
  kind = "all",
): Promise<StrengthExerciseDto[]> {
  const knownIds = Object.values(featuredEnduranceDbIds);
  const byId = await loadCatalogRows(client, knownIds);
  const byCardio = await client.query(
    `SELECT exercise_id, name, gif_url, overview, body_parts, target_muscles, secondary_muscles,
            equipments, instructions, exercise_types, difficulty, equipment_key, source
     FROM exercise_catalog
     WHERE body_parts ? 'cardio'`,
  );
  const rows = [...byId, ...(byCardio.rows as CatalogRow[])];
  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    if (seen.has(row.exercise_id)) return false;
    seen.add(row.exercise_id);
    return true;
  });

  return ENDURANCE_EXERCISES.filter((exercise) => {
    if (equipment && equipment !== "all" && exercise.equipment !== equipment) return false;
    return matchesEnduranceKind(exercise, kind);
  }).map((exercise) => enduranceFeaturedToDto(exercise, pickEnduranceFeaturedMatch(exercise, unique)));
}

export async function listEnduranceExercises(
  client: DbClient,
  options: { equipment?: string; kind?: string; q?: string; offset?: number; limit?: number },
) {
  const equipment = String(options.equipment || "all").trim() || "all";
  const kindRaw = String(options.kind || "all").trim() || "all";
  const kind = kindRaw === "cardio" || kindRaw === "aerobic" ? kindRaw : "all";
  const q = String(options.q || "").trim();
  const offset = Math.max(Number(options.offset) || 0, 0);
  const limit = Math.min(Math.max(Number(options.limit) || 24, 1), 60);
  const warmed = await ensureCardioWarm(client);
  let warning = warmed.warning;
  await ensureLocalFeaturedEndurance(client);
  const featured = await listEnduranceFeatured(client, equipment, kind);
  const featuredIds = new Set(featured.map((item) => item.exerciseId).filter(Boolean));

  const queryCatalog = async () => {
    const params: unknown[] = [];
    const where = [
      `(
        body_parts ? 'cardio'
        OR lower(target_muscles::text) LIKE '%cardiovascular%'
        OR lower(name) ~ '(jump|skip|sprint|burpee|mountain climber|jumping jack|high knee|jump rope|kettlebell swing|skater|box jump|shuffle|bear crawl|aerobic)'
      )`,
      `lower(name) !~ '(stretch|depth jump)'`,
    ];
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where.push(
        `(lower(name) LIKE $${params.length} OR lower(target_muscles::text) LIKE $${params.length} OR lower(body_parts::text) LIKE $${params.length})`,
      );
    }
    if (featuredIds.size) {
      params.push([...featuredIds]);
      where.push(`NOT (exercise_id = ANY($${params.length}::text[]))`);
    }

    const whereSql = where.join(" AND ");
    const listResult = await client.query(
      `SELECT exercise_id, name, gif_url, overview, body_parts, target_muscles, secondary_muscles,
              equipments, instructions, exercise_types, difficulty, equipment_key, source
       FROM exercise_catalog
       WHERE ${whereSql}
       ORDER BY lower(name) ASC`,
      params,
    );
    const mapped = (listResult.rows as CatalogRow[])
      .map((row) => enduranceCatalogToDto(row))
      .filter((item): item is StrengthExerciseDto => Boolean(item))
      .filter((item) => equipment === "all" || item.equipment === equipment)
      .filter((item) => matchesEnduranceKind(item, kind));
    return {
      total: mapped.length,
      catalog: mapped.slice(offset, offset + limit),
    };
  };

  let { catalog, total } = await queryCatalog();
  if (q && total === 0 && !warmed.fetched) {
    try {
      const page = await fetchExerciseDbPage({ name: q, bodyParts: "cardio", limit: 25 });
      await upsertExercises(client, page.items, page.source, enduranceEquipmentKeyFromDb);
      ({ catalog, total } = await queryCatalog());
    } catch (error) {
      if (!warning && isExerciseDbRateLimit(error)) {
        warning = "Showing saved exercises. The live catalog could not be searched yet.";
      }
    }
  }
  return {
    source: getExerciseDbSource(),
    warning,
    featured: q
      ? featured.filter((item) => {
          const blob = `${item.name} ${item.targetMuscles.join(" ")} ${item.bodyParts.join(" ")}`.toLowerCase();
          return blob.includes(q.toLowerCase());
        })
      : featured,
    catalog: {
      items: catalog,
      total,
      limit,
      offset,
      hasMore: offset + catalog.length < total,
    },
    attribution: {
      required: true,
      text: "Exercise names, instructions, and GIFs from ExerciseDB by AscendAPI.",
      url: "https://ascendapi.com",
    },
  };
}

const STRETCH_SYNC_KEYS = [
  { key: "stretch", name: "stretch", yogaOnly: false },
  { key: "yoga", name: "yoga", yogaOnly: false },
  { key: "yoga-pose", name: "pose", yogaOnly: true },
  { key: "yoga-sphinx", name: "sphinx", yogaOnly: true },
  { key: "yoga-dog", name: "facing dog", yogaOnly: true },
  { key: "yoga-big-toe", name: "big toe", yogaOnly: true },
];

const FLEXIBILITY_NAME_SQL = `lower(name) ~ '(stretch|yoga|asana|\\ypose\\y|facing dog|\\ysphinx\\y|jump|plyo|box jump|depth jump|clap push|plyo push|skater|drop jump|star jump|scissor jump|astride jump|jack jump)'`;
const FLEXIBILITY_EXCLUDE_SQL = `(
  lower(name) ~ '(jump|plyo|box jump|depth jump|clap push|plyo push|skater|drop jump|star jump|scissor jump|astride jump|jack jump)'
  OR lower(name) !~ '(push-up|push up|planche|lunge|bridge|curl|press|crunch|deadlift|split squat)'
)`;
const FLEXIBILITY_WHERE_SQL = `(${FLEXIBILITY_NAME_SQL}) AND (${FLEXIBILITY_EXCLUDE_SQL})`;

async function countFlexibility(client: DbClient) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS n FROM exercise_catalog
     WHERE ${FLEXIBILITY_WHERE_SQL}`,
  );
  return Number(result.rows[0]?.n || 0);
}

async function ensureFlexibilityWarm(client: DbClient) {
  const existing = await countFlexibility(client);
  for (const syncKey of STRETCH_SYNC_KEYS) {
    const sync = await getSyncRow(client, syncKey.key);
    if (sync?.complete) continue;
    if (recentlySynced(sync?.synced_at)) continue;
    try {
      const page = await fetchExerciseDbPage({
        name: syncKey.name,
        after: sync?.next_cursor || null,
        limit: 25,
      });
      const items = syncKey.yogaOnly
        ? page.items.filter((item) => isYogaExercise(item.name))
        : page.items;
      await upsertExercises(client, items, page.source, flexibilityEquipmentKeyFromDb);
      const itemCount = await countFlexibility(client);
      await client.query(
        `INSERT INTO exercise_catalog_sync (equipment_name, next_cursor, complete, item_count, synced_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (equipment_name) DO UPDATE SET
           next_cursor = EXCLUDED.next_cursor,
           complete = EXCLUDED.complete,
           item_count = EXCLUDED.item_count,
           synced_at = NOW()`,
        [syncKey.key, page.hasNextPage ? page.nextCursor : null, !page.hasNextPage, itemCount],
      );
      return { warning: null as string | null, fetched: true };
    } catch (error) {
      if (isExerciseDbRateLimit(error)) {
        return {
          warning: existing ? null : "Showing saved exercises. The live catalog could not be searched yet.",
          fetched: false,
        };
      }
      throw error;
    }
  }
  return { warning: null as string | null, fetched: false };
}

function flexibilityDescription(row: CatalogRow) {
  const overview = String(row.overview || "").trim();
  if (overview) return overview;
  const kind = isPlyometricExercise(row.name)
    ? "plyometric"
    : isYogaExercise(row.name)
      ? "yoga pose"
      : "stretch";
  const muscles = visibleMuscles(row.target_muscles);
  if (muscles.length) return `A ${kind} for the ${muscles.join(", ")}.`;
  const parts = asStringArray(row.body_parts);
  if (parts.length) return `A ${kind} for the ${parts.join(", ")}.`;
  return `A ${kind} from the ExerciseDB catalog.`;
}

function flexibilityCatalogToDto(row: CatalogRow): StrengthExerciseDto | null {
  if (
    !isFlexibilityExercise({
      name: row.name,
      bodyParts: asStringArray(row.body_parts),
    })
  ) {
    return null;
  }
  const equipment = (flexibilityEquipmentKeyFromDb(asStringArray(row.equipments)) ||
    row.equipment_key) as FlexibilityEquipmentKey | null;
  if (!equipment) return null;
  const region = flexibilityRegionFromDb({
    name: row.name,
    bodyParts: asStringArray(row.body_parts),
    targetMuscles: asStringArray(row.target_muscles),
  }) as FlexibilityRegionKey;
  const program = flexibilityProgramFor(row.name);
  return {
    id: row.exercise_id,
    exerciseId: row.exercise_id,
    featured: false,
    name: displayExerciseName(row.name),
    equipment,
    region,
    description: flexibilityDescription(row),
    instructions: asStringArray(row.instructions),
    benefits: isPlyometricExercise(row.name)
      ? [...DEFAULT_PLYOMETRIC_BENEFITS]
      : [...DEFAULT_FLEXIBILITY_BENEFITS],
    sets: program.sets,
    repetitions: program.repetitions,
    rest: program.rest,
    gifUrl: exerciseGifUrl(row.exercise_id, row.gif_url),
    targetMuscles: visibleMuscles(row.target_muscles),
    bodyParts: asStringArray(row.body_parts),
    secondaryMuscles: visibleMuscles(row.secondary_muscles),
  };
}

function flexibilityFeaturedToDto(
  exercise: (typeof FLEXIBILITY_EXERCISES)[number],
  match: CatalogRow | null,
): StrengthExerciseDto {
  const knownId = featuredFlexibilityDbIds[exercise.id] || null;
  const trustedMatch = match && flexibilityGifMatches(exercise, match) ? match : null;
  return {
    id: exercise.id,
    exerciseId: trustedMatch?.exercise_id || knownId,
    featured: true,
    name: exercise.name,
    equipment: exercise.equipment as FlexibilityEquipmentKey,
    region: exercise.region as FlexibilityRegionKey,
    description: exercise.description,
    instructions: exercise.instructions,
    benefits: exercise.benefits,
    sets: exercise.sets,
    repetitions: exercise.repetitions,
    rest: exercise.rest,
    gifUrl: exerciseGifUrl(trustedMatch?.exercise_id || knownId, trustedMatch?.gif_url),
    targetMuscles: trustedMatch ? visibleMuscles(trustedMatch.target_muscles) : [],
    bodyParts: trustedMatch ? asStringArray(trustedMatch.body_parts) : [],
    secondaryMuscles: trustedMatch ? visibleMuscles(trustedMatch.secondary_muscles) : [],
  };
}

function flexibilityGifMatches(
  exercise: (typeof FLEXIBILITY_EXERCISES)[number],
  row: CatalogRow | null,
) {
  if (!row) return false;
  const wantedId = featuredFlexibilityDbIds[exercise.id];
  if (wantedId && row.exercise_id === wantedId) return true;
  return scoreNameMatch(row.name, [exercise.name, ...(featuredFlexibilityDbNames[exercise.id] || [])]) === 100;
}

function pickFlexibilityFeaturedMatch(exercise: (typeof FLEXIBILITY_EXERCISES)[number], rows: CatalogRow[]) {
  const wantedId = featuredFlexibilityDbIds[exercise.id];
  if (wantedId) {
    const exact = rows.find((row) => row.exercise_id === wantedId);
    if (exact) return exact;
  }
  const aliases = [exercise.name, ...(featuredFlexibilityDbNames[exercise.id] || [])];
  let best: CatalogRow | null = null;
  let bestScore = 0;
  for (const row of rows) {
    const score = scoreNameMatch(row.name, aliases);
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return flexibilityGifMatches(exercise, best) ? best : null;
}

function matchesFlexibilityKind(name: string, kind: string) {
  if (!kind || kind === "all") return true;
  if (kind === "yoga") return isYogaExercise(name);
  if (kind === "plyo") return isPlyometricExercise(name);
  if (kind === "stretch") return isStretchExercise(name);
  return true;
}

async function listFlexibilityFeatured(
  client: DbClient,
  region: string,
  kind = "all",
): Promise<StrengthExerciseDto[]> {
  const knownIds = Object.values(featuredFlexibilityDbIds);
  const byId = await loadCatalogRows(client, knownIds);
  const byName = await client.query(
    `SELECT exercise_id, name, gif_url, overview, body_parts, target_muscles, secondary_muscles,
            equipments, instructions, exercise_types, difficulty, equipment_key, source
     FROM exercise_catalog
     WHERE ${FLEXIBILITY_WHERE_SQL}`,
  );
  const rows = [...byId, ...(byName.rows as CatalogRow[])];
  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    if (seen.has(row.exercise_id)) return false;
    seen.add(row.exercise_id);
    return true;
  });

  return FLEXIBILITY_EXERCISES.filter((exercise) => {
    if (!matchesFlexibilityKind(exercise.name, kind)) return false;
    if (!region || region === "all") return true;
    return exercise.region === region;
  }).map((exercise) => flexibilityFeaturedToDto(exercise, pickFlexibilityFeaturedMatch(exercise, unique)));
}

export async function listFlexibilityExercises(
  client: DbClient,
  options: { region?: string; kind?: string; q?: string; offset?: number; limit?: number },
) {
  const regionRaw = String(options.region || "all").trim() || "all";
  const kindRaw = String(options.kind || "").trim();
  let kind = kindRaw === "stretch" || kindRaw === "yoga" || kindRaw === "plyo" ? kindRaw : "all";
  if (kind === "all" && regionRaw === "yoga") kind = "yoga";
  const filter = FLEXIBILITY_FILTER_KEYS.includes(regionRaw) ? regionRaw : "all";
  const region = FLEXIBILITY_REGION_KEYS.includes(filter) ? filter : "all";
  const q = String(options.q || "").trim();
  const offset = Math.max(Number(options.offset) || 0, 0);
  const limit = Math.min(Math.max(Number(options.limit) || 24, 1), 60);
  const warmed = await ensureFlexibilityWarm(client);
  let warning = warmed.warning;
  const featured = await listFlexibilityFeatured(client, region, kind);
  const featuredIds = new Set(featured.map((item) => item.exerciseId).filter(Boolean));

  const queryCatalog = async () => {
    const params: unknown[] = [];
    const where = [FLEXIBILITY_WHERE_SQL];
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where.push(
        `(lower(name) LIKE $${params.length} OR lower(target_muscles::text) LIKE $${params.length} OR lower(body_parts::text) LIKE $${params.length})`,
      );
    }
    if (featuredIds.size) {
      params.push([...featuredIds]);
      where.push(`NOT (exercise_id = ANY($${params.length}::text[]))`);
    }

    const whereSql = where.join(" AND ");
    const listResult = await client.query(
      `SELECT exercise_id, name, gif_url, overview, body_parts, target_muscles, secondary_muscles,
              equipments, instructions, exercise_types, difficulty, equipment_key, source
       FROM exercise_catalog
       WHERE ${whereSql}
       ORDER BY lower(name) ASC`,
      params,
    );
    const mapped = (listResult.rows as CatalogRow[])
      .map((row) => flexibilityCatalogToDto(row))
      .filter((item): item is StrengthExerciseDto => Boolean(item))
      .filter((item) => {
        if (!matchesFlexibilityKind(item.name, kind)) return false;
        return region === "all" || item.region === region;
      });
    return {
      total: mapped.length,
      catalog: mapped.slice(offset, offset + limit),
    };
  };

  let { catalog, total } = await queryCatalog();
  if (q && total === 0 && !warmed.fetched) {
    try {
      const page = await fetchExerciseDbPage({ name: q, limit: 25 });
      await upsertExercises(client, page.items, page.source, flexibilityEquipmentKeyFromDb);
      ({ catalog, total } = await queryCatalog());
    } catch (error) {
      if (!warning && isExerciseDbRateLimit(error)) {
        warning = "Showing saved exercises. The live catalog could not be searched yet.";
      }
    }
  }
  return {
    source: getExerciseDbSource(),
    warning,
    featured: q
      ? featured.filter((item) => {
          const blob = `${item.name} ${item.targetMuscles.join(" ")} ${item.bodyParts.join(" ")}`.toLowerCase();
          return blob.includes(q.toLowerCase());
        })
      : featured,
    catalog: {
      items: catalog,
      total,
      limit,
      offset,
      hasMore: offset + catalog.length < total,
    },
    attribution: {
      required: true,
      text: "Exercise names, instructions, and GIFs from ExerciseDB by AscendAPI.",
      url: "https://ascendapi.com",
    },
  };
}
