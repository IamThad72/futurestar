import assert from "node:assert/strict";
import test from "node:test";
import {
  attendanceLabel,
  normalizeAttendance,
  streakMessage,
  weekStartFor,
  worshipStreak,
  worshipTerms,
} from "../utils/worshipCheckin.js";

test("wording follows the tradition", () => {
  assert.equal(worshipTerms("catholic").service, "Mass");
  assert.equal(worshipTerms("orthodox").service, "Divine Liturgy");
  assert.equal(worshipTerms("protestant").service, "worship service");
  assert.equal(worshipTerms("christian").service, "worship service");
  assert.equal(worshipTerms("").service, "worship service");
  assert.equal(attendanceLabel("in_person", "catholic"), "At Mass in person");
  assert.equal(attendanceLabel("online", "orthodox"), "Joined the Divine Liturgy online");
});

test("weeks start on Sunday", () => {
  assert.equal(weekStartFor("2026-11-22"), "2026-11-22"); // Sunday
  assert.equal(weekStartFor("2026-11-28"), "2026-11-22"); // Saturday
  assert.equal(weekStartFor("2026-11-23"), "2026-11-22");
  assert.equal(weekStartFor("2027-01-01"), "2026-12-27");
  assert.equal(weekStartFor("bad"), "");
  assert.equal(weekStartFor("2026-02-31"), "");
  assert.equal(weekStartFor("2026-02-29"), "");
});

test("attendance values are checked", () => {
  assert.equal(normalizeAttendance("In_Person"), "in_person");
  assert.equal(normalizeAttendance("maybe"), "");
});

test("streak counts consecutive weeks of worship, in person or online", () => {
  const rows = [
    { week_start: "2026-11-22", attendance: "in_person" },
    { week_start: "2026-11-15", attendance: "online" },
    { week_start: "2026-11-08", attendance: "in_person" },
    { week_start: "2026-11-01", attendance: "not_this_week" },
    { week_start: "2026-10-25", attendance: "in_person" },
  ];
  assert.equal(worshipStreak(rows, "2026-11-24"), 3);
});

test("an unrecorded current week does not break the streak", () => {
  const rows = [
    { week_start: "2026-11-15", attendance: "in_person" },
    { week_start: "2026-11-08", attendance: "in_person" },
  ];
  assert.equal(worshipStreak(rows, "2026-11-23"), 2);
});

test("a gap or 'not this week' ends the streak", () => {
  assert.equal(worshipStreak([{ week_start: "2026-11-22", attendance: "not_this_week" }, { week_start: "2026-11-15", attendance: "in_person" }], "2026-11-22"), 0);
  assert.equal(worshipStreak([{ week_start: "2026-11-08", attendance: "in_person" }], "2026-11-22"), 0);
  assert.equal(worshipStreak([], "2026-11-22"), 0);
});

test("streak copy is gentle at every count", () => {
  for (const count of [0, 1, 2, 10]) {
    const text = streakMessage(count, "catholic");
    assert.ok(text.length > 0);
    assert.doesNotMatch(text, /miss|broke|lost|fail|should/i);
  }
  assert.match(streakMessage(0, "catholic"), /Mass/);
  assert.match(streakMessage(0, "protestant"), /worship/);
});
