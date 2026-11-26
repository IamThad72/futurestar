import { createError } from "h3";
import type { Client } from "pg";
import {
  calendarKindForProfile,
  defaultFaithProfile,
  includesDeuterocanon,
  legacyFaithProfile,
  normalizeFaithProfile,
} from "~/utils/faithProfile.js";

export type FaithProfile = {
  tradition: "christian" | "protestant" | "catholic" | "orthodox";
  translation: string;
  show_calendar: boolean;
};

export type LoadedFaithProfile = {
  profile: FaithProfile;
  /** False when the user has not chosen yet (defaults apply and the Faith home asks once). */
  exists: boolean;
  /** True before scripts/create_faith_profiles.sql has run; the original Catholic experience applies. */
  unavailable: boolean;
};

export function faithProfileUnavailable(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code || "") : "";
  return code === "42P01" || code === "42703";
}

/** Shown to people using the app. The script path stays in the server log. */
export const FAITH_PROFILE_SETUP_MESSAGE = "Faith settings are not set up yet.";

const FAITH_PROFILE_SETUP_HINT =
  "Faith settings storage is not set up. Run scripts/create_faith_profiles.sql in Supabase (or npm run migrate).";

function logFaithProfileSetup(error?: unknown) {
  console.error(FAITH_PROFILE_SETUP_HINT, error ?? "");
}

function mapRow(row: Record<string, unknown>): FaithProfile {
  return normalizeFaithProfile({
    tradition: row.tradition,
    translation: row.translation,
    show_calendar: row.show_calendar,
  }) as FaithProfile;
}

/** The signed-in user's faith profile. Private: keyed by user_id only. */
export async function readFaithProfile(client: Client, userId: number): Promise<LoadedFaithProfile> {
  try {
    const result = await client.query(
      `SELECT tradition, translation, show_calendar
       FROM user_faith_profiles
       WHERE user_id = $1`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) return { profile: defaultFaithProfile() as FaithProfile, exists: false, unavailable: false };
    return { profile: mapRow(row), exists: true, unavailable: false };
  } catch (error) {
    if (faithProfileUnavailable(error)) {
      logFaithProfileSetup(error);
      return { profile: legacyFaithProfile() as FaithProfile, exists: false, unavailable: true };
    }
    throw error;
  }
}

export async function saveFaithProfile(client: Client, userId: number, body: Record<string, unknown>) {
  const current = await readFaithProfile(client, userId);
  if (current.unavailable) {
    throw createError({
      statusCode: 503,
      statusMessage: FAITH_PROFILE_SETUP_MESSAGE,
    });
  }
  let next: FaithProfile;
  try {
    next = normalizeFaithProfile(body, { strict: true, base: current.profile }) as FaithProfile;
  } catch (error) {
    throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : "Invalid faith settings." });
  }
  const result = await client.query(
    `INSERT INTO user_faith_profiles (user_id, tradition, translation, show_calendar)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       tradition = EXCLUDED.tradition,
       translation = EXCLUDED.translation,
       show_calendar = EXCLUDED.show_calendar,
       updated_at = NOW()
     RETURNING tradition, translation, show_calendar`,
    [userId, next.tradition, next.translation, next.show_calendar],
  );
  return { profile: mapRow(result.rows[0]), exists: true, unavailable: false } as LoadedFaithProfile;
}

/** Options for Scripture lookups from a profile. */
export function scriptureOptions(profile: FaithProfile) {
  return {
    translation: profile.translation,
    includeDeuterocanon: includesDeuterocanon(profile.tradition),
  };
}

export function calendarKind(profile: FaithProfile) {
  return calendarKindForProfile(profile) as "roman" | "church_year" | "off";
}
