#!/usr/bin/env node
/**
 * Fetch the Inadiutorium Church Calendar API into Postgres.
 * Docs: http://calapi.inadiutorium.cz/api-doc
 *
 * Default calendar: English General Roman (`/api/v0/en/calendars/default`).
 * Days are loaded month-by-month. `/calendars/default/{year}` is lectionary
 * setup (A/B/C), not a year of days.
 *
 * Usage:
 *   node scripts/seed-liturgical-calendar.mjs
 *   node scripts/seed-liturgical-calendar.mjs 2026
 *   node scripts/seed-liturgical-calendar.mjs 2026 2027
 *   LITURGICAL_YEARS=2026,2027 node scripts/seed-liturgical-calendar.mjs
 *
 * With no years given, loads the current civil year and the next one.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { Client } from "pg";

const API_ORIGIN = "http://calapi.inadiutorium.cz";
const API_VERSION = "v0";
const DEFAULT_LOCALE = "en";
const DEFAULT_CALENDAR_KEY = "default";
const REQUEST_GAP_MS = 250;
const USER_AGENT = "futurestar-liturgical-seed/1.0";

function loadEnv() {
  try {
    const content = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // no .env
  }
}

loadEnv();

function dbConfig() {
  const { DATABASE_URL, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSL } =
    process.env;
  if (DATABASE_URL) {
    return {
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes("supabase") ? { rejectUnauthorized: false } : false,
    };
  }
  if (!DB_HOST || !DB_PORT || !DB_NAME || !DB_USER) {
    console.error("Set DATABASE_URL or DB_HOST, DB_PORT, DB_NAME, DB_USER in .env");
    process.exit(1);
  }
  return {
    host: DB_HOST,
    port: Number(DB_PORT),
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseYears() {
  const fromArgs = process.argv.slice(2).filter((arg) => /^\d{4}$/.test(arg));
  const fromEnv = String(process.env.LITURGICAL_YEARS || "")
    .split(/[,\s]+/)
    .filter((arg) => /^\d{4}$/.test(arg));
  const raw = fromArgs.length ? fromArgs : fromEnv;
  const years = [...new Set(raw.map(Number))].sort((a, b) => a - b);
  if (years.length) return years;
  const current = new Date().getFullYear();
  return [current, current + 1];
}

function apiBase(locale) {
  return `${API_ORIGIN}/api/${API_VERSION}/${locale}`;
}

async function fetchJson(url, { retries = 2 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `${res.status} ${res.statusText} for ${url}${body ? `: ${body.slice(0, 200)}` : ""}`,
        );
      }
      return { url, data: await res.json() };
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(REQUEST_GAP_MS * (attempt + 2));
        continue;
      }
    }
  }
  throw lastError;
}

function isDayEntry(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.date === "string" &&
    Array.isArray(value.celebrations)
  );
}

function normalizeMonthPayload(payload) {
  if (Array.isArray(payload) && payload.every(isDayEntry)) return payload;
  if (isDayEntry(payload)) return [payload];
  return null;
}

async function fetchMonthDays(base, calendarKey, year, month) {
  const url = `${base}/calendars/${calendarKey}/${year}/${month}`;
  const { data } = await fetchJson(url);
  const days = normalizeMonthPayload(data);
  if (!days) {
    throw new Error(
      `Unexpected month payload from ${url}: ${JSON.stringify(data).slice(0, 180)}`,
    );
  }
  return { url, days };
}

async function upsertChunks(client, table, columns, rows, conflict, update, chunkSize = 200) {
  const colCount = columns.length;
  const colSql = columns.join(", ");
  const conflictSql = `ON CONFLICT (${conflict}) DO UPDATE SET ${update}`;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    if (!slice.length) continue;
    const params = [];
    const values = slice.map((row, r) => {
      const base = r * colCount;
      params.push(...row);
      return `(${Array.from({ length: colCount }, (_, c) => `$${base + c + 1}`).join(", ")})`;
    });
    await client.query(
      `INSERT INTO ${table} (${colSql}) VALUES ${values.join(", ")} ${conflictSql}`,
      params,
    );
  }
}

async function insertChunks(client, table, columns, rows, chunkSize = 200) {
  const colCount = columns.length;
  const colSql = columns.join(", ");
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    if (!slice.length) continue;
    const params = [];
    const values = slice.map((row, r) => {
      const base = r * colCount;
      params.push(...row);
      return `(${Array.from({ length: colCount }, (_, c) => `$${base + c + 1}`).join(", ")})`;
    });
    await client.query(
      `INSERT INTO ${table} (${colSql}) VALUES ${values.join(", ")}`,
      params,
    );
  }
}

async function run() {
  const locale = process.env.LITURGICAL_LOCALE || DEFAULT_LOCALE;
  const calendarKey = process.env.LITURGICAL_CALENDAR || DEFAULT_CALENDAR_KEY;
  const calendarId = `${locale}-${calendarKey}`;
  const years = parseYears();
  const base = apiBase(locale);
  const fetchedAt = new Date();

  console.log(
    `Seeding liturgical calendar ${calendarId} for civil years ${years.join(", ")}`,
  );
  console.log(`API base: ${base}`);

  const calendarsUrl = `${base}/calendars`;
  const { data: calendarIds } = await fetchJson(calendarsUrl);
  if (!Array.isArray(calendarIds) || !calendarIds.includes(calendarKey)) {
    throw new Error(
      `Calendar "${calendarKey}" not in API list: ${JSON.stringify(calendarIds)}`,
    );
  }

  const descUrl = `${base}/calendars/${calendarKey}`;
  const { data: description } = await fetchJson(descUrl);
  await sleep(REQUEST_GAP_MS);

  const lectionaryByYear = new Map();
  const lectionaryYears = [
    ...new Set(years.flatMap((year) => [year - 1, year])),
  ].sort((a, b) => a - b);
  for (const year of lectionaryYears) {
    const yearUrl = `${base}/calendars/${calendarKey}/${year}`;
    const { data } = await fetchJson(yearUrl);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error(
        `Year endpoint did not return lectionary setup: ${yearUrl}`,
      );
    }
    lectionaryByYear.set(year, {
      lectionary: data.lectionary ?? null,
      ferial_lectionary:
        data.ferial_lectionary == null ? null : Number(data.ferial_lectionary),
      source_url: yearUrl,
    });
    console.log(
      `  Year ${year} lectionary=${data.lectionary ?? "?"} ferial=${data.ferial_lectionary ?? "?"}`,
    );
    await sleep(REQUEST_GAP_MS);
  }

  const dayRows = [];
  const celebrationRows = [];
  const dayDates = [];

  for (const year of years) {
    for (let month = 1; month <= 12; month++) {
      const { url, days } = await fetchMonthDays(base, calendarKey, year, month);
      console.log(`  ${year}-${String(month).padStart(2, "0")}: ${days.length} days`);
      for (const day of days) {
        dayDates.push(day.date);
        dayRows.push([
          calendarId,
          day.date,
          String(day.season || ""),
          Number(day.season_week),
          String(day.weekday || ""),
          url,
          fetchedAt,
        ]);
        const celebrations = Array.isArray(day.celebrations) ? day.celebrations : [];
        celebrations.forEach((celebration, index) => {
          celebrationRows.push([
            calendarId,
            day.date,
            index,
            String(celebration?.title ?? ""),
            celebration?.rank ?? null,
            celebration?.rank_num == null ? null : Number(celebration.rank_num),
            celebration?.colour ?? celebration?.color ?? null,
            celebration?.celebration_type ?? celebration?.type ?? null,
          ]);
        });
      }
      await sleep(REQUEST_GAP_MS);
    }
  }

  if (!dayRows.length) {
    console.error("No liturgical days fetched.");
    process.exit(1);
  }

  const client = new Client(dbConfig());
  await client.connect();
  console.log("Connected to database.\n");

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO liturgical_calendars (
         calendar_id, locale, calendar_key, title, language,
         system_promulgated, system_effective_since, system_desc,
         source_url, fetched_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (calendar_id) DO UPDATE SET
         locale = EXCLUDED.locale,
         calendar_key = EXCLUDED.calendar_key,
         title = EXCLUDED.title,
         language = EXCLUDED.language,
         system_promulgated = EXCLUDED.system_promulgated,
         system_effective_since = EXCLUDED.system_effective_since,
         system_desc = EXCLUDED.system_desc,
         source_url = EXCLUDED.source_url,
         fetched_at = EXCLUDED.fetched_at`,
      [
        calendarId,
        locale,
        calendarKey,
        description?.sanctorale?.title ?? "General Roman Calendar",
        description?.sanctorale?.language ?? locale,
        description?.system?.promulgated ?? null,
        description?.system?.effective_since ?? null,
        description?.system?.desc ?? null,
        descUrl,
        fetchedAt,
      ],
    );

    const yearRows = lectionaryYears.map((year) => {
      const row = lectionaryByYear.get(year);
      return [
        calendarId,
        year,
        row.lectionary,
        row.ferial_lectionary,
        row.source_url,
        fetchedAt,
      ];
    });
    await upsertChunks(
      client,
      "liturgical_years",
      [
        "calendar_id",
        "civil_year",
        "lectionary",
        "ferial_lectionary",
        "source_url",
        "fetched_at",
      ],
      yearRows,
      "calendar_id, civil_year",
      `lectionary = EXCLUDED.lectionary,
       ferial_lectionary = EXCLUDED.ferial_lectionary,
       source_url = EXCLUDED.source_url,
       fetched_at = EXCLUDED.fetched_at`,
    );

    await upsertChunks(
      client,
      "liturgical_days",
      [
        "calendar_id",
        "day_date",
        "season",
        "season_week",
        "weekday",
        "source_url",
        "fetched_at",
      ],
      dayRows,
      "calendar_id, day_date",
      `season = EXCLUDED.season,
       season_week = EXCLUDED.season_week,
       weekday = EXCLUDED.weekday,
       source_url = EXCLUDED.source_url,
       fetched_at = EXCLUDED.fetched_at`,
    );

    await client.query(
      `DELETE FROM liturgical_celebrations
       WHERE calendar_id = $1
         AND day_date = ANY($2::date[])`,
      [calendarId, dayDates],
    );
    await insertChunks(
      client,
      "liturgical_celebrations",
      [
        "calendar_id",
        "day_date",
        "sort_order",
        "title",
        "rank",
        "rank_num",
        "color",
        "celebration_type",
      ],
      celebrationRows,
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }

  console.log(`Upserted ${dayRows.length} days and ${celebrationRows.length} celebrations.`);
  console.log(
    `Re-run with a year: node scripts/seed-liturgical-calendar.mjs ${years[0]}`,
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
