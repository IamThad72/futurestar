import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCatalogMatches,
  applyDescriptionSchedule,
  applyPrescriptions,
  avoidTerms,
  catalogNameMatch,
  descriptionWords,
  excludesAvoid,
  expandSchedule,
  prescribedMoves,
  normalizeBlocks,
  normalizePlan,
  normalizeProgression,
  parsePlanRequest,
  pickCandidates,
  proposedAdditions,
  scheduleFromDescription,
  sessionSeconds,
} from "../utils/workoutPlan.js";

const rows = [
  { exercise_id: "sq", name: "Bodyweight Squat", equipment_key: "body" },
  { exercise_id: "pu", name: "Push-up", equipment_key: "body" },
  { exercise_id: "row", name: "Dumbbell Row", equipment_key: "dumbbell" },
  { exercise_id: "run", name: "Outdoor Run", equipment_key: "outdoor" },
  { exercise_id: "stretch", name: "Hip Stretch", equipment_key: "body" },
];

test("candidate list keeps one recent exercise and a spread of patterns", () => {
  const picked = pickCandidates(rows, ["row"]);
  const ids = picked.map((item) => item.exerciseId);
  assert.ok(ids.includes("row"));
  assert.ok(ids.includes("sq"));
  assert.ok(ids.includes("pu"));
  assert.equal(new Set(ids).size, ids.length);
});

test("plan keeps catalog matches and flags exercises that are not in the catalog", () => {
  const candidates = pickCandidates(rows, []);
  const plan = normalizePlan(
    {
      summary: "Three short days.",
      days: [
        {
          name: "Day 1",
          exercises: [
            { exerciseId: "sq", sets: 8, reps: 8, restSeconds: 60, description: "A squat pattern for the legs." },
            { exerciseId: "made-up", name: "Invented Press", sets: 3, reps: 8 },
            { exerciseId: "nope" },
          ],
        },
      ],
    },
    candidates,
    10,
  );
  assert.equal(plan.days[0].exercises.length, 2);
  assert.equal(plan.days[0].exercises[0].name, "Bodyweight Squat");
  assert.equal(plan.days[0].exercises[0].matched, true);
  assert.equal(plan.days[0].exercises[0].notes, "A squat pattern for the legs.");
  assert.equal(plan.days[0].exercises[1].name, "Invented Press");
  assert.equal(plan.days[0].exercises[1].matched, false);
  assert.equal(plan.overTime, true);
});

test("a short session fits the requested minutes", () => {
  const seconds = sessionSeconds([{ sets: 2, reps: 8, restSeconds: 30 }]);
  assert.equal(seconds, 2 * 40 + 30);
  const plan = normalizePlan(
    { days: [{ name: "Day 1", exercises: [{ exerciseId: "pu", sets: 2, reps: 8, restSeconds: 30 }] }] },
    pickCandidates(rows, []),
    45,
  );
  assert.equal(plan.overTime, false);
});

test("missing names stay unique and match an existing catalog row", () => {
  const additions = proposedAdditions({
    missing: [
      { name: "Farmer Carry", equipment: "dumbbell", reason: "Grip" },
      { name: "Farmer Carry", equipment: "dumbbell" },
      { name: "Sprint", equipment: "nope" },
    ],
  });
  assert.equal(additions.length, 2);
  assert.equal(additions[1].equipment, "body");
  assert.equal(catalogNameMatch("push", [{ name: "Push-up", exerciseId: "pu" }]).exerciseId, "pu");
  assert.equal(catalogNameMatch("nothing", [{ name: "Push-up" }]), null);
});

test("16 weeks at 5 days lists 80 training days", () => {
  const days = Array.from({ length: 5 }, (_, index) => ({
    name: `Day ${index + 1}`,
    exercises: [{ name: "Squat", exerciseId: "sq", sets: 3, reps: 8, restSeconds: 60, matched: true }],
  }));
  const schedule = expandSchedule([{ fromWeek: 1, toWeek: 16, days }], 16, [
    { fromWeek: 1, toWeek: 16, change: "Add a rep when the sets feel solid." },
  ]);
  assert.equal(schedule.length, 80);
  assert.equal(schedule[0].name, "Week 1 Day 1 · Day 1");
  assert.equal(schedule[79].name, "Week 16 Day 5 · Day 5");
  assert.equal(schedule[0].exercises[0].reps, 8);
  assert.equal(schedule[20].exercises[0].reps, 9);
  assert.equal(schedule[35].exercises[0].reps, 8);
  assert.equal(schedule[0].progression, "Add a rep when the sets feel solid.");
});

test("a later block replaces the weekly sessions for those weeks", () => {
  const draft = normalizeBlocks(
    {
      name: "Strength then conditioning",
      blocks: [
        { fromWeek: 1, toWeek: 4, days: [{ name: "Lower", exercises: [{ exerciseId: "sq", sets: 3, reps: 5 }] }] },
        { fromWeek: 5, toWeek: 8, days: [{ name: "Engine", exercises: [{ exerciseId: "run", durationSeconds: 600 }] }] },
      ],
    },
    pickCandidates(rows, []),
    45,
    1,
    8,
  );
  assert.equal(draft.blocks.length, 2);
  const schedule = expandSchedule(draft.blocks, 8, []);
  assert.equal(schedule.length, 8);
  assert.equal(schedule[0].exercises[0].name, "Bodyweight Squat");
  assert.equal(schedule[4].exercises[0].name, "Outdoor Run");
});

test("a catalog name match clears the highlight on that exercise", () => {
  const blocks = applyCatalogMatches(
    [{ fromWeek: 1, toWeek: 4, days: [{ name: "Carry", exercises: [{ name: "Farmer Carry", matched: false, exerciseId: null }] }] }],
    [{ name: "Farmer Carry", exerciseId: "carry", matchedName: "Farmer Carry" }],
  );
  assert.equal(blocks[0].days[0].exercises[0].matched, true);
  assert.equal(blocks[0].days[0].exercises[0].exerciseId, "carry");
});

test("description words skip the schedule language", () => {
  assert.deepEqual(descriptionWords("16 weeks of squat and bench work, 5 days"), ["squat", "bench", "work"]);
});

const FAT_BURN_PROMPT =
  "Create an 80 plan that mixes exercises available in the futurestar database along with other suggestions. to reach the Mixed goal. Focus attention on fat burning exercises and core stabilization exercises. Each day's plan should not be less than 40 or more than 45 minutes. Don't use bands and remove air bike because I DON'T KNOW WHAT THAT IS! For 3 of the 5 workouts per week include an additional 50 push ups, 50 lunges, 50 second plank, 50-plyo squats";

test("a described 80-day plan sets 16 weeks, 5 days, and 45 minutes", () => {
  const parsed = scheduleFromDescription(FAT_BURN_PROMPT);
  assert.equal(parsed.daysPerWeek, 5);
  assert.equal(parsed.durationWeeks, 16);
  assert.equal(parsed.minutes, 45);
  assert.equal(parsed.minuteFloor, 40);
  assert.equal(parsed.goal, "mixed");
  assert.deepEqual(parsed.avoid, ["bands", "air bike"]);
  const request = applyDescriptionSchedule(parsePlanRequest({ description: FAT_BURN_PROMPT, daysPerWeek: 3, durationCount: 8 }));
  assert.equal(request.scheduleDays, 80);
  assert.equal(request.daysPerWeek, 5);
  assert.equal(excludesAvoid("Resistance Band Row", parsed.avoid), true);
  assert.equal(excludesAvoid("Air Bike", parsed.avoid), true);
  assert.equal(excludesAvoid("Push-up", parsed.avoid), false);
  assert.ok(descriptionWords(FAT_BURN_PROMPT).includes("plank"));
  assert.ok(descriptionWords(FAT_BURN_PROMPT).includes("squat"));
  assert.equal(descriptionWords(FAT_BURN_PROMPT).includes("bike"), false);
});

test("50 push-ups stay 50 reps, and a short week is filled out", () => {
  const draft = normalizeBlocks(
    {
      blocks: [
        {
          name: "Day 1",
          exercises: [{ exercise: "Push-up", sets: 50, reps: 1, description: "Fifty push-ups." }],
        },
        {
          name: "Day 2",
          exercises: ["Bodyweight Squat"],
        },
      ],
    },
    pickCandidates(rows, []),
    45,
    5,
    16,
  );
  assert.equal(draft.blocks.length, 1);
  assert.equal(draft.blocks[0].days.length, 5);
  assert.equal(draft.blocks[0].days[0].exercises[0].reps, 50);
  assert.equal(draft.blocks[0].days[0].exercises[0].sets, 1);
  assert.equal(draft.blocks[0].days[1].exercises[0].name, "Bodyweight Squat");
  assert.equal(draft.blocks[0].days[1].exercises[0].matched, true);
});

test("fifty-rep finishers stay on three of the five days", () => {
  const prescription = prescribedMoves(FAT_BURN_PROMPT);
  assert.equal(prescription.onDays, 3);
  assert.deepEqual(
    prescription.moves.map((item) => item.name),
    ["Plank", "Push-up", "Lunge", "Plyo squat"],
  );
  const days = Array.from({ length: 5 }, (_, index) => ({
    name: `Day ${index + 1}`,
    exercises:
      index < 2
        ? [
            { name: "Push-up", sets: 3, reps: 8, restSeconds: 60, matched: true, exerciseId: "push" },
            { name: "Burpee", sets: 3, reps: 8, restSeconds: 60, matched: true, exerciseId: "burpee" },
          ]
        : [{ name: "Burpee", sets: 3, reps: 8, restSeconds: 60, matched: true, exerciseId: "burpee" }],
  }));
  const [block] = applyPrescriptions([{ fromWeek: 1, toWeek: 16, days }], prescription);
  assert.equal(block.days[0].exercises[0].reps, 50);
  assert.equal(block.days[0].exercises[0].sets, 1);
  assert.equal(block.days[0].exercises.find((item) => item.name === "Plank").durationSeconds, 50);
  assert.equal(block.days[2].exercises.some((item) => item.name === "Plyo squat"), true);
  assert.equal(block.days[3].exercises.some((item) => item.name === "Push-up"), false);
});

test("avoid terms come from the description", () => {
  assert.deepEqual(avoidTerms("Don't use bands and remove air bike because it is confusing."), ["bands", "air bike"]);
});

test("request defaults stay inside the prototype bounds", () => {
  const request = parsePlanRequest({ daysPerWeek: 9, minutes: 5, equipment: ["machine", "band"], goal: "endurance" });
  assert.equal(request.daysPerWeek, 5);
  assert.equal(request.minutes, 15);
  assert.deepEqual(request.equipment, ["machine"]);
  assert.equal(request.goal, "endurance");
  assert.equal(request.durationWeeks, 8);
  assert.equal(request.scheduleDays, 40);
  assert.equal(parsePlanRequest({ description: "  Build strength five days a week.  " }).description, "Build strength five days a week.");
});

test("weight loss can last for months and progression covers the whole plan", () => {
  const request = parsePlanRequest({ goal: "weight-loss", durationCount: 3, durationUnit: "months" });
  assert.equal(request.goal, "weight-loss");
  assert.equal(request.durationWeeks, 12);
  const phases = normalizeProgression(
    { progression: [{ fromWeek: 1, toWeek: 4, change: "Learn the sessions." }] },
    request.durationWeeks,
  );
  assert.equal(phases[0].fromWeek, 1);
  assert.equal(phases[phases.length - 1].toWeek, 12);
  assert.match(phases[0].label, /Week/);
});
