export const OSS_EXERCISE_DB_BASE = "https://oss.exercisedb.dev";
export const RAPID_EXERCISE_DB_HOST = "edb-with-gifs-and-images-by-ascendapi.p.rapidapi.com";
export const EXERCISE_DB_PAGE_SIZE = 25;
export const EXERCISE_DB_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ExerciseDbSource = "oss_v1" | "rapidapi_v1";

export type ExerciseDbRaw = {
  exerciseId?: string;
  name?: string;
  gifUrl?: string;
  gifUrls?: Record<string, string>;
  overview?: string;
  bodyParts?: string[];
  targetMuscles?: string[];
  secondaryMuscles?: string[];
  equipments?: string[];
  instructions?: string[];
  exerciseTypes?: string[];
  difficulty?: string;
};

export type ExerciseDbPage = {
  source: ExerciseDbSource;
  items: ExerciseDbRaw[];
  nextCursor: string | null;
  hasNextPage: boolean;
  total: number;
};

type ExerciseDbConfig = {
  apiKey: string;
  baseUrl: string;
};

function readConfig(): ExerciseDbConfig {
  const runtime = useRuntimeConfig();
  return {
    apiKey: String(runtime.exerciseDbApiKey || "").trim(),
    baseUrl: String(runtime.exerciseDbBaseUrl || "").trim().replace(/\/$/, ""),
  };
}

export function getExerciseDbSource(config = readConfig()): ExerciseDbSource {
  return config.apiKey ? "rapidapi_v1" : "oss_v1";
}

function getBaseUrl(config = readConfig()) {
  if (config.baseUrl) return config.baseUrl;
  if (config.apiKey) return `https://${RAPID_EXERCISE_DB_HOST}`;
  return OSS_EXERCISE_DB_BASE;
}

function getHeaders(config = readConfig()): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (!config.apiKey) return headers;
  const host = config.baseUrl
    ? new URL(config.baseUrl).host
    : RAPID_EXERCISE_DB_HOST;
  headers["X-RapidAPI-Key"] = config.apiKey;
  headers["X-RapidAPI-Host"] = host;
  return headers;
}

export function isExerciseDbRateLimit(error: unknown) {
  const status =
    error && typeof error === "object" && "statusCode" in error
      ? Number((error as { statusCode?: number }).statusCode)
      : NaN;
  return status === 429;
}

export const EXERCISE_GIF_BASE = "https://static.exercisedb.dev/media";
export const BROKEN_EXERCISE_GIF_IDS = new Set(["gTGciXz", "v6EKk0O", "PCUYOMs", "pFuK3by"]);

export function exerciseGifUrl(exerciseId?: string | null, stored?: string | null) {
  const id = String(exerciseId || "").trim();
  if (id && BROKEN_EXERCISE_GIF_IDS.has(id)) return null;
  const url = String(stored || "").trim();
  if (url) return url;
  // Local featured ids (e.g. outdoor-walk) are not ExerciseDB media keys.
  if (!id || id.includes("-")) return null;
  return `${EXERCISE_GIF_BASE}/${id}.gif`;
}

export function pickGifUrl(raw: ExerciseDbRaw | Record<string, unknown> | null | undefined) {
  if (!raw || typeof raw !== "object") return null;
  const gifUrl = "gifUrl" in raw ? raw.gifUrl : null;
  if (typeof gifUrl === "string" && gifUrl.trim()) return gifUrl.trim();
  const gifUrls = "gifUrls" in raw ? raw.gifUrls : null;
  if (gifUrls && typeof gifUrls === "object") {
    const record = gifUrls as Record<string, string>;
    return record["360p"] || record["480p"] || record["720p"] || Object.values(record).find(Boolean) || null;
  }
  return null;
}

export function cleanInstruction(step: string) {
  return String(step || "")
    .replace(/^Step:\s*\d+\s*/i, "")
    .trim();
}

export function displayExerciseName(name: string) {
  return String(name || "")
    .trim()
    .replace(/\s*\((male|female)\)\s*$/i, "")
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      if (/^v\.\d/i.test(word) || /^v\.\s*\d/i.test(word)) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

export function normalizeExercise(raw: ExerciseDbRaw) {
  const exerciseId = String(raw.exerciseId || "").trim();
  return {
    exerciseId,
    name: String(raw.name || "").trim(),
    gifUrl: pickGifUrl(raw),
    overview: String(raw.overview || "").trim() || null,
    bodyParts: asStringArray(raw.bodyParts),
    targetMuscles: asStringArray(raw.targetMuscles),
    secondaryMuscles: asStringArray(raw.secondaryMuscles),
    equipments: asStringArray(raw.equipments),
    instructions: asStringArray(raw.instructions).map(cleanInstruction),
    exerciseTypes: asStringArray(raw.exerciseTypes),
    difficulty: String(raw.difficulty || "").trim() || null,
  };
}

async function exerciseDbFetch(path: string, query: Record<string, string | number | undefined>) {
  const config = readConfig();
  const url = new URL(path, `${getBaseUrl(config)}/`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, { headers: getHeaders(config) });
  if (response.status === 429) {
    throw createError({ statusCode: 429, statusMessage: "Exercise catalog is busy. Try again in a moment." });
  }
  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: "Could not load the exercise catalog.",
    });
  }
  return response.json() as Promise<Record<string, unknown>>;
}

function parsePage(payload: Record<string, unknown>, source: ExerciseDbSource): ExerciseDbPage {
  const data = Array.isArray(payload.data) ? payload.data : [];
  const meta =
    payload.meta && typeof payload.meta === "object"
      ? (payload.meta as Record<string, unknown>)
      : payload.metadata && typeof payload.metadata === "object"
        ? (payload.metadata as Record<string, unknown>)
        : {};
  const nextCursor = typeof meta.nextCursor === "string" && meta.nextCursor ? meta.nextCursor : null;
  const hasNextPage = Boolean(meta.hasNextPage) || Boolean(nextCursor);
  const total = Number(meta.total ?? meta.totalExercises ?? data.length) || data.length;
  return {
    source,
    items: data.filter((item) => item && typeof item === "object") as ExerciseDbRaw[],
    nextCursor,
    hasNextPage,
    total,
  };
}

export async function fetchExerciseDbPage(options: {
  equipments?: string;
  bodyParts?: string;
  name?: string;
  after?: string | null;
  limit?: number;
}) {
  const source = getExerciseDbSource();
  const payload = await exerciseDbFetch("/api/v1/exercises", {
    limit: Math.min(Math.max(options.limit || EXERCISE_DB_PAGE_SIZE, 1), EXERCISE_DB_PAGE_SIZE),
    equipments: options.equipments,
    bodyParts: options.bodyParts,
    name: options.name,
    after: options.after || undefined,
  });
  return parsePage(payload, source);
}

export async function fetchExerciseDbById(exerciseId: string) {
  const source = getExerciseDbSource();
  const payload = await exerciseDbFetch(`/api/v1/exercises/${encodeURIComponent(exerciseId)}`, {});
  const raw =
    payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? (payload.data as ExerciseDbRaw)
      : (payload as ExerciseDbRaw);
  if (!raw?.exerciseId && !raw?.name) return null;
  return { source, item: raw };
}
