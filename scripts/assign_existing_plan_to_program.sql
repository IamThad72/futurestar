-- Optional one-time backfill. NOT registered in scripts/run-migrations.mjs.
-- Do not run this automatically, and do not run it against production until
-- the preview below has been reviewed and approved in JonnyDev's chat.
--
-- Run only after scripts/create_workout_programs.sql has been applied.
-- Hard-require one user_id. Never update all users. Never use the demo account.
-- This file writes nothing until the placeholders in params are replaced.
-- As shipped, user_id is NULL, so the preview returns no rows and the
-- INSERT below is commented out.
--
-- The write inserts rows into workout_program_items only. It does not
-- UPDATE or DELETE workouts. Non-matching workouts stay Unassigned.
-- Safe to re-run: it does not create a second program when the name
-- already exists, and ON CONFLICT DO NOTHING skips links that are already there.

-- Preview only. Replace NULL with the approved user id, and optionally
-- set program_id, program_name, and name_prefix before reviewing the list.
WITH params AS (
    SELECT
        NULL::integer AS user_id,
        NULL::integer AS program_id,
        NULL::text AS program_name,
        NULL::text AS name_prefix
)
SELECT w.workout_id,
       w.name,
       w.created_at,
       (substring(w.name from '[Ww]eek\s+([0-9]+)'))::int AS week,
       (substring(w.name from '[Dd]ay\s+([0-9]+)'))::int AS day
FROM workouts w
CROSS JOIN params p
WHERE p.user_id IS NOT NULL
  AND w.user_id = p.user_id
  AND w.name ~* 'Week\s+[0-9]+\s+Day\s+[0-9]+'
  AND (p.name_prefix IS NULL OR lower(w.name) LIKE lower(p.name_prefix) || '%')
  AND (
      p.program_id IS NULL
      OR NOT EXISTS (
          SELECT 1
          FROM workout_program_items i
          WHERE i.workout_id = w.workout_id
            AND i.program_id = p.program_id
      )
  )
ORDER BY week, day, w.workout_id;

-- After the preview is approved, replace the NULLs in params and run
-- this write. It creates the named program only when that user does not
-- already have it, then links the previewed workouts.
--
-- WITH params AS (
--     SELECT
--         NULL::integer AS user_id,
--         NULL::text AS program_name,
--         NULL::text AS name_prefix
-- ),
-- ensured AS (
--     INSERT INTO workout_programs (user_id, name, description)
--     SELECT p.user_id, btrim(p.program_name), NULL
--     FROM params p
--     WHERE p.user_id IS NOT NULL
--       AND p.program_name IS NOT NULL
--       AND length(btrim(p.program_name)) > 0
--       AND NOT EXISTS (
--           SELECT 1
--           FROM workout_programs existing
--           WHERE existing.user_id = p.user_id
--             AND lower(btrim(existing.name)) = lower(btrim(p.program_name))
--       )
--     RETURNING program_id, user_id
-- ),
-- target AS (
--     SELECT program_id, user_id FROM ensured
--     UNION ALL
--     SELECT existing.program_id, existing.user_id
--     FROM workout_programs existing
--     JOIN params p ON p.user_id = existing.user_id
--      AND lower(btrim(existing.name)) = lower(btrim(p.program_name))
-- )
-- INSERT INTO workout_program_items (user_id, program_id, workout_id, sort_order)
-- SELECT t.user_id,
--        t.program_id,
--        w.workout_id,
--        (substring(w.name from '[Ww]eek\s+([0-9]+)'))::int * 100
--          + (substring(w.name from '[Dd]ay\s+([0-9]+)'))::int
-- FROM workouts w
-- JOIN params p ON w.user_id = p.user_id
-- JOIN target t ON t.user_id = p.user_id
-- WHERE p.user_id IS NOT NULL
--   AND w.name ~* 'Week\s+[0-9]+\s+Day\s+[0-9]+'
--   AND (p.name_prefix IS NULL OR lower(w.name) LIKE lower(p.name_prefix) || '%')
-- ON CONFLICT (program_id, workout_id) DO NOTHING;
