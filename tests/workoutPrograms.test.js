import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assignLinkSortOrders,
  bundlePreview,
  defaultLinkSortOrder,
  disambiguateProgramName,
  groupProgramWorkouts,
  groupWorkouts,
  journalSections,
  parseProgramDescription,
  parseProgramName,
  parseWeekDay,
  planNamePrefix,
  weekDayGroups,
} from "../utils/workoutPrograms.js";

test("program names are required and capped at 120 characters", () => {
  assert.deepEqual(parseProgramName("  16-week program  "), { ok: true, name: "16-week program" });
  assert.equal(parseProgramName("   ").ok, false);
  assert.equal(parseProgramName("").ok, false);
  assert.equal(parseProgramName("x".repeat(121)).ok, false);
  assert.equal(parseProgramName("x".repeat(120)).ok, true);
  assert.equal(parseProgramDescription("  keep this  "), "keep this");
  assert.equal(parseProgramDescription("   "), null);
  assert.equal(parseProgramDescription(null), null);
  assert.equal(parseProgramDescription("y".repeat(2001)).length, 2000);
});

test("week and day parse from plan-saved names, including a unique-name clash", () => {
  assert.deepEqual(parseWeekDay("Title · Week 1 Day 1 · Day 1"), { week: 1, day: 1 });
  assert.equal(planNamePrefix("Title · Week 1 Day 1 · Day 1"), "Title");
  assert.equal(defaultLinkSortOrder("Title · Week 1 Day 1 · Day 1", [0]), 101);

  assert.deepEqual(parseWeekDay("Title plan · Week 16 Day 5 · Day 5"), { week: 16, day: 5 });
  assert.equal(planNamePrefix("Title plan · Week 16 Day 5 · Day 5"), "Title plan");
  assert.equal(defaultLinkSortOrder("Title plan · Week 16 Day 5 · Day 5", []), 1605);

  assert.deepEqual(parseWeekDay("week 2 day 3 · Easy"), { week: 2, day: 3 });
  assert.equal(parseWeekDay("Full body strength"), null);
  assert.equal(planNamePrefix("Full body strength"), null);
  assert.equal(defaultLinkSortOrder("Full body strength", []), 0);
  assert.equal(defaultLinkSortOrder("Easy cardio", [0, 4]), 5);
});

test("a batch appends names without a week and keeps week order for the others", () => {
  const assigned = assignLinkSortOrders(
    [
      { workoutId: 2, name: "Title · Week 2 Day 1 · Day 1" },
      { workoutId: 1, name: "Title · Week 1 Day 1 · Day 1" },
      { workoutId: 9, name: "Mobility reset" },
    ],
    [4],
  );
  assert.deepEqual(assigned, [
    { workoutId: 2, sortOrder: 201 },
    { workoutId: 1, sortOrder: 101 },
    { workoutId: 9, sortOrder: 202 },
  ]);
});

test("a workout can sit in two programs while another stays Unassigned", () => {
  const shared = {
    workoutId: 1,
    name: "Title · Week 1 Day 1 · Day 1",
    programs: [
      { programId: 10, name: "Strength", sortOrder: 101 },
      { programId: 11, name: "Conditioning", sortOrder: 5 },
    ],
  };
  const loose = { workoutId: 2, name: "Full body strength", programs: [] };
  const grouped = groupWorkouts([shared, loose], [
    { programId: 10, name: "Strength", sortOrder: 0 },
    { programId: 11, name: "Conditioning", sortOrder: 1 },
  ]);
  assert.deepEqual(
    grouped.programs.map((program) => program.name),
    ["Strength", "Conditioning"],
  );
  assert.deepEqual(grouped.programs[0].workouts.map((workout) => workout.workoutId), [1]);
  assert.deepEqual(grouped.programs[1].workouts.map((workout) => workout.workoutId), [1]);
  assert.deepEqual(grouped.unassigned.map((workout) => workout.workoutId), [2]);

  const sections = journalSections([shared, loose]);
  assert.deepEqual(
    sections.map((section) => section.title),
    ["Conditioning", "Strength", "Unassigned"],
  );
  assert.equal(sections[0].workouts[0].workoutId, 1);
  assert.equal(sections[2].workouts[0].workoutId, 2);
});

test("week headings follow Week N, and names without it stay in a flat list", () => {
  const grouped = groupProgramWorkouts([
    { workoutId: 3, name: "Title · Week 2 Day 1 · Day 1", sortOrder: 201 },
    { workoutId: 1, name: "Title · Week 1 Day 2 · Day 2", sortOrder: 102 },
    { workoutId: 2, name: "Title · Week 1 Day 1 · Day 1", sortOrder: 101 },
    { workoutId: 4, name: "Easy cardio", sortOrder: 300 },
  ]);
  assert.equal(grouped.grouped, true);
  assert.deepEqual(
    grouped.weekGroups.map((group) => [group.week, group.workouts.map((workout) => workout.workoutId)]),
    [
      [1, [2, 1]],
      [2, [3]],
    ],
  );
  assert.deepEqual(grouped.other.map((workout) => workout.workoutId), [4]);

  const flat = groupProgramWorkouts([
    { workoutId: 8, name: "Mobility reset", sortOrder: 1 },
    { workoutId: 7, name: "Full body strength", sortOrder: 0 },
  ]);
  assert.equal(flat.grouped, false);
  assert.deepEqual(flat.weekGroups, []);
  assert.deepEqual(flat.other.map((workout) => workout.workoutId), [7, 8]);
});

test("the Week/Day helper splits prefixes and previews the checked days", () => {
  const workouts = [
    { workoutId: 1, name: "Title · Week 1 Day 1 · Day 1" },
    { workoutId: 2, name: "Title · Week 2 Day 1 · Day 1" },
    { workoutId: 3, name: "Other plan · Week 1 Day 1 · Day 1" },
    { workoutId: 4, name: "Full body strength" },
  ];
  const groups = weekDayGroups(workouts);
  assert.equal(groups.length, 2);
  const title = groups.find((group) => group.prefix === "Title");
  assert.deepEqual(title.workoutIds, [1, 2]);
  assert.equal(title.weekMin, 1);
  assert.equal(title.weekMax, 2);
  const preview = bundlePreview(workouts, [1, 2]);
  assert.equal(preview.count, 2);
  assert.equal(preview.weekMin, 1);
  assert.equal(preview.weekMax, 2);
  assert.equal(preview.sharedTitle, "Title");
  assert.equal(bundlePreview(workouts, [4]).sharedTitle, null);
  assert.equal(bundlePreview(workouts, [4]).weekMin, null);
});

test("an existing program name gets a numeric suffix", () => {
  assert.equal(disambiguateProgramName("Fat burn", []), "Fat burn");
  assert.equal(disambiguateProgramName("Fat burn", ["Fat burn"]), "Fat burn (2)");
  assert.equal(disambiguateProgramName("Fat burn", ["fat burn", "Fat burn (2)"]), "Fat burn (3)");
});

test("the schema migration is registered last and does not insert links", () => {
  const sql = readFileSync(new URL("../scripts/create_workout_programs.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS workout_programs/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS workout_program_items/);
  assert.match(sql, /ON DELETE CASCADE/);
  assert.match(sql, /idx_workouts_user_id/);
  assert.doesNotMatch(sql, /INSERT\s+INTO/i);
  assert.match(sql, /Never add group_id/);
  assert.doesNotMatch(sql, /group_id\s+(INTEGER|TEXT|BIGINT)/i);

  const runner = readFileSync(new URL("../scripts/run-migrations.mjs", import.meta.url), "utf8");
  const files = [...runner.matchAll(/"([^"]+\.sql)"/g)].map((match) => match[1]);
  assert.equal(files.at(-1), "create_workout_programs.sql");
  assert.equal(files.filter((name) => name === "create_workout_programs.sql").length, 1);
  assert.equal(files.includes("assign_existing_plan_to_program.sql"), false);

  const backfill = readFileSync(new URL("../scripts/assign_existing_plan_to_program.sql", import.meta.url), "utf8");
  assert.match(backfill, /NOT registered/);
  assert.match(backfill, /NULL::integer AS user_id/);
  assert.doesNotMatch(backfill, /^INSERT\s+INTO/im);
  assert.match(backfill, /workout_program_items/);
  assert.doesNotMatch(sql, /ALTER TABLE workouts/i);
});

test("manager copy keeps programs and workouts distinct and confirms program delete", () => {
  const page = readFileSync(new URL("../pages/physical/workouts/index.vue", import.meta.url), "utf8");
  const board = readFileSync(new URL("../components/WorkoutProgramBoard.vue", import.meta.url), "utf8");
  const row = readFileSync(new URL("../components/WorkoutProgramRow.vue", import.meta.url), "utf8");
  const journal = readFileSync(new URL("../components/WorkoutExerciseJournal.vue", import.meta.url), "utf8");
  assert.match(page, /New program/);
  assert.match(board, /Add to program/);
  assert.match(row, /Remove from this program/);
  assert.match(board, /Select Week\/Day workouts/);
  assert.match(
    board,
    /Delete this program\? Its workouts stay in your list, and they remain in any other programs they belong to\./,
  );
  assert.match(journal, /journalSections/);
  assert.doesNotMatch(page, /navigateTo\(\s*["'`]\/login/);
  assert.doesNotMatch(board, /autofocus/);
});
