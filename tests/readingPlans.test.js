import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  dateForDay,
  daysToSkip,
  oldTestamentBooks,
  parseReference,
  planDayReadings,
  planDays,
  planProgress,
  plansForTradition,
  READING_PLANS,
  readingsFromChapters,
  rescheduledStart,
  scheduledDay,
  spreadEvenly,
  suggestedStart,
  readingPlan,
  isDeuterocanonicalReading,
} from "../utils/readingPlans.js";

// ------------------------------------------------------------- day calculation

test("the start date is day 1 and each calendar day adds one", () => {
  assert.equal(scheduledDay("2026-11-22", "2026-11-22", 30), 1);
  assert.equal(scheduledDay("2026-11-22", "2026-11-23", 30), 2);
  assert.equal(scheduledDay("2026-11-22", "2026-12-21", 30), 30);
});

test("before the start date nothing is scheduled; after the end it stays on the last day", () => {
  assert.equal(scheduledDay("2026-12-01", "2026-11-22", 25), 0);
  assert.equal(scheduledDay("2026-11-01", "2027-03-01", 30), 30);
});

test("day math crosses months, leap days and daylight saving changes", () => {
  assert.equal(scheduledDay("2028-02-27", "2028-03-01", 365), 4); // 2028 is a leap year
  assert.equal(scheduledDay("2026-03-07", "2026-03-09", 365), 3); // US DST starts Mar 8
  assert.equal(scheduledDay("2026-12-31", "2027-01-01", 365), 2);
  assert.equal(dateForDay("2026-12-31", 2), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
});

test("bad dates schedule nothing", () => {
  assert.equal(scheduledDay("", "2026-11-22", 30), 0);
  assert.equal(scheduledDay("2026-11-22", "nope", 30), 0);
});

// ------------------------------------------------------------- progress and catch-up

test("on track: today's day is unread and nothing is missed", () => {
  const p = planProgress({ length: 30, startOn: "2026-11-20", today: "2026-11-22", entries: { 1: "done", 2: "done" } });
  assert.equal(p.scheduledDay, 3);
  assert.equal(p.nextDay, 3);
  assert.deepEqual(p.missed, []);
  assert.equal(p.behind, 0);
  assert.equal(p.todayDone, false);
  assert.equal(p.done, 2);
  assert.equal(p.percent, 7);
});

test("missed days are unread days before today, not today itself", () => {
  const p = planProgress({ length: 30, startOn: "2026-11-15", today: "2026-11-22", entries: { 1: "done", 3: "done" } });
  assert.equal(p.scheduledDay, 8);
  assert.deepEqual(p.missed, [2, 4, 5, 6, 7]);
  assert.equal(p.nextDay, 2);
  assert.deepEqual(daysToSkip(p), [2, 4, 5, 6, 7]);
});

test("skipped days count as handled, not as read", () => {
  const p = planProgress({ length: 10, startOn: "2026-11-20", today: "2026-11-22", entries: { 1: "skipped", 2: "done" } });
  assert.deepEqual(p.missed, []);
  assert.equal(p.done, 1);
  assert.equal(p.skipped, 1);
  assert.equal(p.nextDay, 3);
});

test("catching up by skipping leaves today's reading as the next one", () => {
  const entries = new Map([[1, "done"]]);
  const before = planProgress({ length: 30, startOn: "2026-11-15", today: "2026-11-22", entries });
  for (const day of daysToSkip(before)) entries.set(day, "skipped");
  const after = planProgress({ length: 30, startOn: "2026-11-15", today: "2026-11-22", entries });
  assert.deepEqual(after.missed, []);
  assert.equal(after.nextDay, 8);
  assert.equal(after.scheduledDay, 8);
});

test("shifting dates makes the next unread day today, with nothing missed", () => {
  const entries = { 1: "done", 2: "done" };
  const before = planProgress({ length: 30, startOn: "2026-11-10", today: "2026-11-22", entries });
  assert.equal(before.nextDay, 3);
  assert.equal(before.behind, 10);
  const start = rescheduledStart("2026-11-22", before.nextDay);
  assert.equal(start, "2026-11-20");
  const after = planProgress({ length: 30, startOn: start, today: "2026-11-22", entries });
  assert.equal(after.scheduledDay, 3);
  assert.deepEqual(after.missed, []);
  assert.equal(rescheduledStart("2026-11-22", 1), "2026-11-22");
});

test("reading ahead is allowed and shown as ahead", () => {
  const p = planProgress({ length: 30, startOn: "2026-11-22", today: "2026-11-22", entries: { 1: "done", 2: "done" } });
  assert.equal(p.todayDone, true);
  assert.equal(p.ahead, true);
  assert.equal(p.nextDay, 3);
});

test("a plan that has not started yet has nothing missed", () => {
  const p = planProgress({ length: 25, startOn: "2026-12-01", today: "2026-11-22", entries: {} });
  assert.equal(p.notStarted, true);
  assert.equal(p.scheduledDay, 0);
  assert.deepEqual(p.missed, []);
  assert.equal(p.endsOn, "2026-12-25");
});

test("a plan is finished when every day is read or skipped", () => {
  const entries = Object.fromEntries(Array.from({ length: 31 }, (_, i) => [i + 1, i % 5 ? "done" : "skipped"]));
  const p = planProgress({ length: 31, startOn: "2026-10-01", today: "2026-11-22", entries });
  assert.equal(p.finished, true);
  assert.equal(p.nextDay, null);
  assert.equal(p.done + p.skipped, 31);
});

test("well past the end, every unread day is missed", () => {
  const p = planProgress({ length: 5, startOn: "2026-01-01", today: "2026-11-22", entries: { 1: "done" } });
  assert.equal(p.scheduledDay, 5);
  assert.deepEqual(p.missed, [2, 3, 4]);
  assert.equal(p.nextDay, 2);
});

// ------------------------------------------------------------- references

test("references parse into chapter and verse segments", () => {
  assert.deepEqual(parseReference("Isaiah 9:2-7").segments, [{ chapter: 9, start: 2, end: 7 }]);
  assert.deepEqual(parseReference("Psalm 51").segments, [{ chapter: 51, start: null, end: null }]);
  assert.equal(parseReference("Psalm 51").book, "Psalms");
  assert.deepEqual(parseReference("John 18-19").segments, [
    { chapter: 18, start: null, end: null },
    { chapter: 19, start: null, end: null },
  ]);
  assert.deepEqual(parseReference("Isaiah 52:13-53:12").segments, [
    { chapter: 52, start: 13, end: null },
    { chapter: 53, start: 1, end: 12 },
  ]);
  assert.equal(parseReference("1 Samuel 2:1-10").book, "1 Samuel");
  assert.equal(parseReference("Luke 2:1-14").citation, "Luke 2:1–14");
  assert.throws(() => parseReference("not a reference"));
});

test("consecutive chapters group into one reading", () => {
  const readings = readingsFromChapters([
    { book: "Genesis", chapter: 1 },
    { book: "Genesis", chapter: 2 },
    { book: "Genesis", chapter: 3 },
    { book: "Exodus", chapter: 1 },
  ]);
  assert.deepEqual(readings.map((r) => r.citation), ["Genesis 1–3", "Exodus 1"]);
});

test("spreading keeps order and uses every item once", () => {
  const parts = spreadEvenly(Array.from({ length: 89 }, (_, i) => i), 30);
  assert.equal(parts.length, 30);
  assert.deepEqual(parts.flat(), Array.from({ length: 89 }, (_, i) => i));
  assert.ok(parts.every((part) => part.length === 2 || part.length === 3));
});

// ------------------------------------------------------------- the library

function chaptersRead(key, options) {
  const seen = [];
  for (const day of planDays(key, options)) {
    for (const reading of day) for (const segment of reading.segments) seen.push(`${reading.book} ${segment.chapter}`);
  }
  return seen;
}

test("every plan has the advertised number of days and no empty day", () => {
  for (const plan of READING_PLANS) {
    for (const includeDeuterocanon of [false, true]) {
      const days = planDays(plan.key, { includeDeuterocanon });
      assert.equal(days.length, plan.length, plan.key);
      assert.ok(days.every((day) => day.length > 0), `${plan.key} has an empty day`);
    }
  }
  assert.equal(readingPlan("bible-year").length, 365);
  assert.equal(readingPlan("gospels-30").length, 30);
  assert.equal(readingPlan("psalms-proverbs-31").length, 31);
  assert.equal(readingPlan("advent").length, 25);
  assert.equal(readingPlan("lent").length, 47);
});

test("Bible in a Year reads all 1,189 chapters exactly once", () => {
  const seen = chaptersRead("bible-year", { includeDeuterocanon: false });
  assert.equal(seen.length, 1189);
  assert.equal(new Set(seen).size, 1189);
});

test("Catholic Bible in a Year adds the deuterocanon and the Greek parts of Esther and Daniel", () => {
  const seen = chaptersRead("bible-year", { includeDeuterocanon: true });
  assert.equal(seen.length, 1189 + 137 + 6 + 2);
  assert.equal(new Set(seen).size, seen.length);
  assert.ok(seen.includes("Sirach 51"));
  assert.ok(seen.includes("Esther 16"));
  assert.ok(seen.includes("Daniel 14"));
  assert.equal(oldTestamentBooks({ includeDeuterocanon: true }).findIndex((b) => b.book === "Tobit"), 16);
});

test("non-Catholic plans never include deuterocanonical readings", () => {
  for (const plan of plansForTradition("protestant")) {
    for (const day of planDays(plan.key, { includeDeuterocanon: false })) {
      assert.ok(!day.some(isDeuterocanonicalReading), `${plan.key} has a deuterocanonical reading`);
    }
  }
});

test("Advent day 8 reads Baruch in Catholic mode and Malachi otherwise", () => {
  assert.equal(planDayReadings("advent", 8, { includeDeuterocanon: true })[0].book, "Baruch");
  assert.equal(planDayReadings("advent", 8, { includeDeuterocanon: false })[0].book, "Malachi");
});

test("the deuterocanon plan is offered in Catholic mode only", () => {
  assert.ok(plansForTradition("catholic").some((p) => p.key === "deuterocanon-30"));
  for (const tradition of ["christian", "protestant", "orthodox", ""]) {
    assert.ok(!plansForTradition(tradition).some((p) => p.key === "deuterocanon-30"), tradition);
  }
});

test("Gospels in 30 days covers all 89 Gospel chapters; Psalms and Proverbs covers 150 + 31", () => {
  assert.equal(new Set(chaptersRead("gospels-30")).size, 89);
  const pp = chaptersRead("psalms-proverbs-31");
  assert.equal(pp.filter((c) => c.startsWith("Psalms")).length, 150);
  assert.equal(pp.filter((c) => c.startsWith("Proverbs")).length, 31);
  assert.equal(new Set(pp).size, 181);
});

test("Lent ends with the Resurrection and Advent with the Nativity", () => {
  assert.match(planDayReadings("lent", 47)[0].citation, /^John 20/);
  assert.match(planDayReadings("lent", 1)[0].citation, /^Joel 2/);
  assert.match(planDayReadings("advent", 24)[0].citation, /^Luke 2:1/);
});

test("seasonal plans suggest their season's start date", () => {
  const advent = readingPlan("advent");
  const lent = readingPlan("lent");
  assert.equal(suggestedStart(advent, "2026-11-22"), "2026-12-01");
  assert.equal(suggestedStart(advent, "2026-12-26"), "2027-12-01");
  // Ash Wednesday 2027 is Feb 10 (Easter Mar 28); the plan's last day is Easter.
  assert.equal(suggestedStart(lent, "2026-11-22"), "2027-02-10");
  assert.equal(addDays(suggestedStart(lent, "2026-11-22"), lent.length - 1), "2027-03-28");
  // Orthodox: counted back from Pascha (May 2, 2027).
  assert.equal(addDays(suggestedStart(lent, "2026-11-22", { tradition: "orthodox" }), lent.length - 1), "2027-05-02");
  assert.equal(suggestedStart(readingPlan("gospels-30"), "2026-11-22"), "2026-11-22");
});
