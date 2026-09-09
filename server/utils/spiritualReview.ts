import { createError } from "h3";
import type { Client } from "pg";
import { privateUserClause } from "./privateUserAccess";

export const REVIEW_TEXT_KEYS = [
  "love_person",
  "virtue",
  "faithful_act",
  "surrender",
  "grateful",
  "presence",
  "troubled",
  "integrity",
  "shortfall",
  "amends",
  "tomorrow",
] as const;

export type SpiritualReviewField = (typeof REVIEW_TEXT_KEYS)[number];

export type SpiritualDailyReview = {
  review_on: string;
} & Record<SpiritualReviewField, string>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LEN = 2000;

const COLUMNS = ["review_on", ...REVIEW_TEXT_KEYS].join(", ");

export function parseReviewDate(value: unknown) {
  const date = String(value || "").trim();
  if (!DATE_RE.test(date)) {
    throw createError({ statusCode: 400, statusMessage: "date must be YYYY-MM-DD." });
  }
  return date;
}

function emptyReview(reviewOn: string): SpiritualDailyReview {
  const review = { review_on: reviewOn } as SpiritualDailyReview;
  for (const key of REVIEW_TEXT_KEYS) review[key] = "";
  return review;
}

function mapReview(row: Record<string, unknown>, reviewOn: string): SpiritualDailyReview {
  const review = emptyReview(reviewOn);
  for (const key of REVIEW_TEXT_KEYS) {
    review[key] = row[key] != null ? String(row[key]) : "";
  }
  if (row.review_on) review.review_on = String(row.review_on).slice(0, 10);
  return review;
}

export function parseReviewPatch(
  body: Record<string, unknown>,
  reviewOn: string,
): Partial<SpiritualDailyReview> & { review_on: string } {
  const patch: Partial<SpiritualDailyReview> & { review_on: string } = { review_on: reviewOn };
  for (const key of REVIEW_TEXT_KEYS) {
    if (!(key in body)) continue;
    const raw = String(body[key] ?? "").trim();
    if (raw.length > MAX_LEN) {
      throw createError({
        statusCode: 400,
        statusMessage: "Each answer must be 2,000 characters or fewer.",
      });
    }
    patch[key] = raw;
  }
  return patch;
}

export async function getSpiritualReview(
  client: Client,
  userId: number,
  reviewOn: string,
): Promise<SpiritualDailyReview> {
  const result = await client.query(
    `SELECT ${COLUMNS}
     FROM spiritual_daily_reviews
     WHERE ${privateUserClause()} AND review_on = $2`,
    [userId, reviewOn],
  );
  return result.rows[0] ? mapReview(result.rows[0], reviewOn) : emptyReview(reviewOn);
}

export async function upsertSpiritualReview(
  client: Client,
  userId: number,
  input: SpiritualDailyReview,
): Promise<SpiritualDailyReview> {
  const result = await client.query(
    `INSERT INTO spiritual_daily_reviews
       (user_id, review_on, love_person, virtue, faithful_act, surrender,
        grateful, presence, troubled, integrity, shortfall, amends, tomorrow)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (user_id, review_on) DO UPDATE SET
       love_person = EXCLUDED.love_person,
       virtue = EXCLUDED.virtue,
       faithful_act = EXCLUDED.faithful_act,
       surrender = EXCLUDED.surrender,
       grateful = EXCLUDED.grateful,
       presence = EXCLUDED.presence,
       troubled = EXCLUDED.troubled,
       integrity = EXCLUDED.integrity,
       shortfall = EXCLUDED.shortfall,
       amends = EXCLUDED.amends,
       tomorrow = EXCLUDED.tomorrow,
       updated_at = NOW()
     RETURNING ${COLUMNS}`,
    [
      userId,
      input.review_on,
      input.love_person,
      input.virtue,
      input.faithful_act,
      input.surrender,
      input.grateful,
      input.presence,
      input.troubled,
      input.integrity,
      input.shortfall,
      input.amends,
      input.tomorrow,
    ],
  );
  return mapReview(result.rows[0], input.review_on);
}

export async function mergeSpiritualReview(
  client: Client,
  userId: number,
  patch: Partial<SpiritualDailyReview> & { review_on: string },
): Promise<SpiritualDailyReview> {
  const existing = await getSpiritualReview(client, userId, patch.review_on);
  const merged = { ...existing, review_on: patch.review_on };
  for (const key of REVIEW_TEXT_KEYS) {
    if (key in patch && patch[key] != null) merged[key] = String(patch[key]);
  }
  return upsertSpiritualReview(client, userId, merged);
}
