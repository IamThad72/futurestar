#!/usr/bin/env node
/**
 * Page ExerciseDB (OSS) into exercise_catalog with delays so rate limits are respected.
 * Usage: node scripts/seed-exercise-catalog.mjs
 */
import { readFileSync } from "fs";
import { join } from "path";
import { Client } from "pg";
import { isYogaExercise } from "../utils/flexibilityExercises.js";

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

const EQUIPMENT = [
  { name: "dumbbell", key: "dumbbell" },
  { name: "kettlebell", key: "kettlebell" },
  { name: "body weight", key: "body" },
  { name: "assisted", key: "assisted" },
  { name: "roller", key: "roller" },
  { name: "wheel roller", key: "roller" },
  { name: "stability ball", key: "ball" },
  { name: "weighted", key: "weighted" },
];

const SKIPPED_EQUIPMENT = [
  { requested: "stick", reason: "OSS v1 has no stick/dowel equipment type" },
];

const CARDIO_MACHINE_EQUIPMENT = [
  "stationary bike",
  "elliptical machine",
  "stepmill machine",
  "leverage machine",
  "skierg machine",
  "upper body ergometer",
  "sled machine",
];

function equipmentKeyFromDb(equipments) {
  const names = (Array.isArray(equipments) ? equipments : []).map((item) =>
    String(item || "")
      .trim()
      .toLowerCase(),
  );
  if (names.includes("kettlebell")) return "kettlebell";
  if (names.includes("dumbbell")) return "dumbbell";
  if (names.includes("band") || names.includes("resistance band")) return null;
  if (names.includes("body weight")) return "body";
  return null;
}

function catalogSeedEquipmentKey(equipments, _name, seededKey) {
  const names = (Array.isArray(equipments) ? equipments : []).map((item) =>
    String(item || "")
      .trim()
      .toLowerCase(),
  );
  if (names.includes("kettlebell")) return "kettlebell";
  if (names.includes("dumbbell")) return "dumbbell";
  if (names.includes("body weight")) return "body";
  if (names.includes("weighted")) return "weighted";
  if (names.includes("assisted")) return "assisted";
  if (names.includes("roller") || names.includes("wheel roller")) return "roller";
  if (names.includes("stability ball")) return "ball";
  return seededKey || null;
}

function enduranceEquipmentKeyFromDb(equipments, name = "") {
  const names = (Array.isArray(equipments) ? equipments : []).map((item) =>
    String(item || "")
      .trim()
      .toLowerCase(),
  );
  const label = String(name || "");
  if (names.includes("dumbbell")) return "dumbbell";
  if (names.includes("rope")) return "rope";
  if (names.some((item) => CARDIO_MACHINE_EQUIPMENT.includes(item))) return "machine";
  if (
    !/\b(jump|burpee|climber|jack|hop|crawl|high knee|push to run|wheel run)\b/i.test(label) &&
    /\b(run|jog|walk|hike|hiking|swim|swimming|trail)\b/i.test(label)
  ) {
    return "outdoor";
  }
  return "body";
}

function cleanInstruction(step) {
  return String(step || "")
    .replace(/^Step:\s*\d+\s*/i, "")
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function flexibilityEquipmentKeyFromDb(equipments) {
  const names = (Array.isArray(equipments) ? equipments : []).map((item) =>
    String(item || "")
      .trim()
      .toLowerCase(),
  );
  if (names.includes("roller") || names.includes("wheel roller")) return "roller";
  if (names.includes("stability ball")) return "ball";
  if (names.includes("assisted")) return "assisted";
  if (names.includes("rope")) return "rope";
  if (names.includes("body weight")) return "body";
  return null;
}

async function fetchPage({ equipments, bodyParts, name, after } = {}) {
  const url = new URL("https://oss.exercisedb.dev/api/v1/exercises");
  url.searchParams.set("limit", "25");
  if (equipments) url.searchParams.set("equipments", equipments);
  if (bodyParts) url.searchParams.set("bodyParts", bodyParts);
  if (name) url.searchParams.set("name", name);
  if (after) url.searchParams.set("after", after);
  const res = await fetch(url);
  if (res.status === 429) {
    const err = new Error("rate limited");
    err.status = 429;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`ExerciseDB ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function upsert(client, items, mapEquipment = equipmentKeyFromDb) {
  const now = new Date().toISOString();
  let stored = 0;
  for (const raw of items) {
    const exerciseId = String(raw.exerciseId || "").trim();
    const name = String(raw.name || "").trim();
    const equipmentKey = mapEquipment(raw.equipments, name);
    if (!exerciseId || !name || !equipmentKey) continue;
    const instructions = (Array.isArray(raw.instructions) ? raw.instructions : [])
      .map(cleanInstruction)
      .filter(Boolean);
    await client.query(
      `INSERT INTO exercise_catalog (
         exercise_id, name, gif_url, overview, body_parts, target_muscles, secondary_muscles,
         equipments, instructions, exercise_types, difficulty, equipment_key, source, fetched_at
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,$14)
       ON CONFLICT (exercise_id) DO UPDATE SET
         name = EXCLUDED.name,
         gif_url = COALESCE(EXCLUDED.gif_url, exercise_catalog.gif_url),
         body_parts = EXCLUDED.body_parts,
         target_muscles = EXCLUDED.target_muscles,
         secondary_muscles = EXCLUDED.secondary_muscles,
         equipments = EXCLUDED.equipments,
         instructions = EXCLUDED.instructions,
         equipment_key = EXCLUDED.equipment_key,
         source = EXCLUDED.source,
         fetched_at = EXCLUDED.fetched_at`,
      [
        exerciseId,
        name,
        raw.gifUrl || `https://static.exercisedb.dev/media/${exerciseId}.gif`,
        raw.overview || null,
        JSON.stringify(raw.bodyParts || []),
        JSON.stringify(raw.targetMuscles || []),
        JSON.stringify(raw.secondaryMuscles || []),
        JSON.stringify(raw.equipments || []),
        JSON.stringify(instructions),
        JSON.stringify(raw.exerciseTypes || []),
        raw.difficulty || null,
        equipmentKey,
        "oss_v1",
        now,
      ],
    );
    stored += 1;
  }
  return stored;
}

async function markSync(client, equipmentName, nextCursor, complete, itemCount) {
  await client.query(
    `INSERT INTO exercise_catalog_sync (equipment_name, next_cursor, complete, item_count, synced_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (equipment_name) DO UPDATE SET
       next_cursor = EXCLUDED.next_cursor,
       complete = EXCLUDED.complete,
       item_count = EXCLUDED.item_count,
       synced_at = NOW()`,
    [equipmentName, complete ? null : nextCursor, complete, itemCount],
  );
}

async function seedEquipment(client, equipment) {
  const sync = await client.query(
    `SELECT next_cursor, complete FROM exercise_catalog_sync WHERE equipment_name = $1`,
    [equipment.name],
  );
  let after = sync.rows[0]?.complete ? null : sync.rows[0]?.next_cursor || null;
  if (sync.rows[0]?.complete) {
    console.log(`✓ ${equipment.name} already complete`);
    return;
  }

  let pages = 0;
  let stored = 0;
  while (true) {
    let json;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        json = await fetchPage({ equipments: equipment.name, after });
        break;
      } catch (error) {
        if (error.status === 429) {
          const wait = 8000 + attempt * 2000;
          console.log(`  rate limited on ${equipment.name}, waiting ${wait / 1000}s`);
          await sleep(wait);
          continue;
        }
        throw error;
      }
    }
    if (!json) throw new Error(`Could not fetch ${equipment.name}`);

    stored += await upsert(client, json.data || [], (equipments, name) =>
      catalogSeedEquipmentKey(equipments, name, equipment.key),
    );
    pages += 1;
    const total = json.meta?.total ?? "?";
    const next = json.meta?.nextCursor || null;
    const done = !json.meta?.hasNextPage;
    await markSync(client, equipment.name, next, done, stored);
    console.log(`  ${equipment.name} page ${pages} (+${(json.data || []).length}) total≈${total} stored=${stored}`);
    if (done) {
      console.log(`✓ ${equipment.name} complete`);
      return;
    }
    after = next;
    await sleep(800);
  }
}

async function seedCardio(client) {
  const sync = await client.query(
    `SELECT next_cursor, complete FROM exercise_catalog_sync WHERE equipment_name = 'cardio'`,
  );
  let after = sync.rows[0]?.complete ? null : sync.rows[0]?.next_cursor || null;
  if (sync.rows[0]?.complete) {
    console.log("✓ cardio already complete");
    return;
  }

  let pages = 0;
  let stored = 0;
  while (true) {
    let json;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        json = await fetchPage({ bodyParts: "cardio", after });
        break;
      } catch (error) {
        if (error.status === 429) {
          const wait = 8000 + attempt * 2000;
          console.log(`  rate limited on cardio, waiting ${wait / 1000}s`);
          await sleep(wait);
          continue;
        }
        throw error;
      }
    }
    if (!json) throw new Error("Could not fetch cardio");

    stored += await upsert(client, json.data || [], enduranceEquipmentKeyFromDb);
    pages += 1;
    const total = json.meta?.total ?? "?";
    const next = json.meta?.nextCursor || null;
    const done = !json.meta?.hasNextPage;
    await markSync(client, "cardio", next, done, stored);
    console.log(`  cardio page ${pages} (+${(json.data || []).length}) total≈${total} stored=${stored}`);
    if (done) {
      console.log("✓ cardio complete");
      return;
    }
    after = next;
    await sleep(800);
  }
}

async function seedByName(client, syncKey, nameQuery, mapEquipment, keepItem) {
  const sync = await client.query(
    `SELECT next_cursor, complete FROM exercise_catalog_sync WHERE equipment_name = $1`,
    [syncKey],
  );
  let after = sync.rows[0]?.complete ? null : sync.rows[0]?.next_cursor || null;
  if (sync.rows[0]?.complete) {
    console.log(`✓ ${syncKey} already complete`);
    return;
  }

  let pages = 0;
  let stored = 0;
  while (true) {
    let json;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        json = await fetchPage({ name: nameQuery, after });
        break;
      } catch (error) {
        if (error.status === 429) {
          const wait = 8000 + attempt * 2000;
          console.log(`  rate limited on ${syncKey}, waiting ${wait / 1000}s`);
          await sleep(wait);
          continue;
        }
        throw error;
      }
    }
    if (!json) throw new Error(`Could not fetch ${syncKey}`);

    const items = (json.data || []).filter((raw) => !keepItem || keepItem(raw));
    stored += await upsert(client, items, mapEquipment);
    pages += 1;
    const total = json.meta?.total ?? "?";
    const next = json.meta?.nextCursor || null;
    const done = !json.meta?.hasNextPage;
    await markSync(client, syncKey, next, done, stored);
    console.log(`  ${syncKey} page ${pages} (+${(json.data || []).length}) total≈${total} stored=${stored}`);
    if (done) {
      console.log(`✓ ${syncKey} complete`);
      return;
    }
    after = next;
    await sleep(800);
  }
}

async function seedFlexibility(client) {
  const yogaRow = (raw) => isYogaExercise(raw.name);
  await seedByName(client, "stretch", "stretch", flexibilityEquipmentKeyFromDb);
  await seedByName(client, "yoga", "yoga", flexibilityEquipmentKeyFromDb);
  await seedByName(client, "yoga-pose", "pose", flexibilityEquipmentKeyFromDb, yogaRow);
  await seedByName(client, "yoga-sphinx", "sphinx", flexibilityEquipmentKeyFromDb, yogaRow);
  await seedByName(client, "yoga-dog", "facing dog", flexibilityEquipmentKeyFromDb, yogaRow);
  await seedByName(client, "yoga-big-toe", "big toe", flexibilityEquipmentKeyFromDb, yogaRow);
}

async function fetchOssTotal(equipmentName) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const json = await fetchPage({ equipments: equipmentName });
      return Number(json.meta?.total ?? 0);
    } catch (error) {
      if (error.status === 429) {
        const wait = 8000 + attempt * 2000;
        console.log(`  rate limited fetching OSS total for ${equipmentName}, waiting ${wait / 1000}s`);
        await sleep(wait);
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Could not fetch OSS total for ${equipmentName}`);
}

async function reportCache(client) {
  for (const skipped of SKIPPED_EQUIPMENT) {
    console.log(`\nSkipped ${skipped.requested}: ${skipped.reason}`);
  }

  const byKey = await client.query(`
    SELECT COALESCE(equipment_key, 'unset') AS equipment_key, COUNT(*)::int AS n
    FROM exercise_catalog
    GROUP BY 1
    ORDER BY 1
  `);
  console.log("\nCache by equipment_key:");
  let catalogTotal = 0;
  for (const row of byKey.rows) {
    catalogTotal += row.n;
    console.log(`  ${row.equipment_key}: ${row.n}`);
  }
  console.log(`  total rows: ${catalogTotal}`);

  const byOssName = await client.query(`
    SELECT lower(trim(eq)) AS oss_equipment, COUNT(*)::int AS n
    FROM exercise_catalog, jsonb_array_elements_text(equipments) AS eq
    GROUP BY 1
    ORDER BY 1
  `);
  console.log("\nCache by OSS equipment name:");
  for (const row of byOssName.rows) {
    console.log(`  ${row.oss_equipment}: ${row.n}`);
  }

  console.log("\nCache vs OSS meta.total:");
  let allComplete = true;
  for (const equipment of EQUIPMENT) {
    const cached = await client.query(
      `SELECT COUNT(*)::int AS n FROM exercise_catalog WHERE equipments ? $1`,
      [equipment.name],
    );
    const cachedN = Number(cached.rows[0]?.n || 0);
    const ossTotal = await fetchOssTotal(equipment.name);
    const complete = cachedN >= ossTotal;
    if (!complete) allComplete = false;
    console.log(
      `  ${equipment.name}: cache=${cachedN} oss=${ossTotal} ${complete ? "complete" : "INCOMPLETE"}`,
    );
    await sleep(800);
  }
  console.log(`\nSeed ${allComplete ? "complete" : "NOT complete"} for requested OSS equipment types.`);

  const strength = await client.query(
    `
    SELECT COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE lower(name) ~ '(press|push-up|push up|bench|flye)')::int AS presses
    FROM exercise_catalog
    WHERE equipment_key = ANY($1::text[])
      AND NOT (body_parts ? 'cardio')
      AND NOT (equipments ? 'band')
      AND NOT (equipments ? 'resistance band')
      AND lower(name) NOT LIKE '%band%'
      AND (
        lower(name) ~ '(row|pull|chin[- ]?up|pulldown|pullover|curl|shrug|inverted|face pull|high pull|gorilla)'
        OR lower(target_muscles::text) ~ '(lats|biceps|traps|rhomboids|upper back|rear deltoid)'
      )
      AND lower(name) !~ '(press|push-up|push up|squat|lunge|bench|flye|crunch|plank|dip|burpee|calf|deadlift|pallof|bridge|carry|walk|jump|stretch|wrist|cable|yoga|asana|\\ypose\\y|facing dog|\\ysphinx\\y)'
  `,
    [["dumbbell", "kettlebell", "body"]],
  );
  console.log(
    `\nStrength pulling subset (body/dumbbell/kettlebell only): ${strength.rows[0].n} (press-like names in subset: ${strength.rows[0].presses})`,
  );
}

async function run() {
  const { DATABASE_URL, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSL } = process.env;
  const clientConfig = DATABASE_URL
    ? {
        connectionString: DATABASE_URL,
        ssl: DATABASE_URL.includes("supabase") ? { rejectUnauthorized: false } : false,
      }
    : {
        host: DB_HOST,
        port: Number(DB_PORT),
        database: DB_NAME,
        user: DB_USER,
        password: DB_PASSWORD,
        ssl: DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      };

  const client = new Client(clientConfig);
  await client.connect();
  console.log("Seeding exercise catalog from ExerciseDB (slow, rate-limit safe)...\n");
  try {
    for (const equipment of EQUIPMENT) {
      await seedEquipment(client, equipment);
    }
    await seedCardio(client);
    await seedFlexibility(client);
    await markSync(client, "pull-seed-v2", null, true, 0);
    const pulling = await client.query(`
      SELECT equipment_key, COUNT(*)::int AS n
      FROM exercise_catalog
      WHERE equipment_key IS NOT NULL
        AND NOT (equipments ? 'band')
        AND NOT (equipments ? 'resistance band')
        AND lower(name) NOT LIKE '%band%'
        AND (
          lower(name) ~ '(row|pull|chin[- ]?up|pulldown|pullover|curl|shrug|inverted|face pull|high pull|gorilla)'
          OR lower(target_muscles::text) ~ '(lats|biceps|traps|rhomboids|upper back|rear deltoid)'
        )
        AND lower(name) !~ '(press|push-up|push up|squat|lunge|bench|flye|crunch|plank|dip|burpee|calf|deadlift|pallof|bridge|carry|walk|jump|stretch|wrist|cable|yoga|asana|\\ypose\\y|facing dog|\\ysphinx\\y)'
      GROUP BY 1
      ORDER BY 1
    `);
    console.log("\nPulling exercises now in cache:");
    for (const row of pulling.rows) console.log(`  ${row.equipment_key}: ${row.n}`);
    const cardio = await client.query(`
      SELECT COALESCE(equipment_key, 'unset') AS equipment_key, COUNT(*)::int AS n
      FROM exercise_catalog
      WHERE body_parts ? 'cardio'
      GROUP BY 1
      ORDER BY 1
    `);
    console.log("\nCardio exercises now in cache:");
    for (const row of cardio.rows) console.log(`  ${row.equipment_key}: ${row.n}`);
    const flexibility = await client.query(`
      SELECT
        CASE
          WHEN body_parts ? 'neck' OR lower(name) ~ 'neck' THEN 'neck'
          WHEN lower(name) ~ '(glute|piriformis|hip|adductor|groin|butterfly|frog|iron cross|world greatest|wide angle)'
               AND lower(name) !~ '(pec|chest)' THEN 'hips'
          WHEN lower(name) ~ '(pec|chest|shoulder|delt|triceps|wrist)' THEN 'shoulders'
          WHEN body_parts ? 'back' OR lower(name) ~ '(spine|lat|thoracic|back|facing dog|sphinx)' THEN 'back'
          WHEN body_parts ? 'shoulders' OR body_parts ? 'chest'
               OR body_parts ? 'upper arms' OR body_parts ? 'lower arms' THEN 'shoulders'
          ELSE 'legs'
        END AS region,
        COUNT(*)::int AS n,
        COUNT(*) FILTER (
          WHERE lower(name) ~ '(yoga|asana|\\ypose\\y|facing dog|\\ysphinx\\y)'
        )::int AS yoga_n
      FROM exercise_catalog
      WHERE lower(name) ~ '(stretch|yoga|asana|\\ypose\\y|facing dog|\\ysphinx\\y)'
        AND lower(name) !~ '(push-up|planche|lunge|bridge|curl|press|crunch|deadlift|split squat)'
        AND NOT (body_parts ? 'cardio')
      GROUP BY 1
      ORDER BY 1
    `);
    console.log("\nFlexibility exercises now in cache:");
    let flexTotal = 0;
    let yogaTotal = 0;
    for (const row of flexibility.rows) {
      flexTotal += row.n;
      yogaTotal += row.yoga_n;
      console.log(`  ${row.region}: ${row.n} (yoga ${row.yoga_n})`);
    }
    console.log(`  total: ${flexTotal} (yoga ${yogaTotal})`);
    await reportCache(client);
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
