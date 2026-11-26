import assert from "node:assert/strict";
import test from "node:test";
import { parsePrayerInput, prayerView, PRAYER_CATEGORIES } from "../utils/prayerList.js";

test("a request needs a title; optional fields become null when blank", () => {
  assert.equal(parsePrayerInput({ title: "  " }, { requireTitle: true }).error, "Give the request a short title.");
  const { value, error } = parsePrayerInput({ title: " Healing ", notes: "", person: " Mom ", category: "Family" }, { requireTitle: true });
  assert.equal(error, "");
  assert.deepEqual(value, { title: "Healing", notes: null, person: "Mom", category: "Family" });
});

test("categories come from the list and dates must be ISO", () => {
  assert.ok(PRAYER_CATEGORIES.includes("Church"));
  assert.match(parsePrayerInput({ category: "Sports" }).error, /category/);
  assert.match(parsePrayerInput({ answered_on: "11/22/2026" }).error, /YYYY-MM-DD/);
  assert.match(parsePrayerInput({ answered_on: "2026-02-31" }).error, /YYYY-MM-DD/);
  assert.match(parsePrayerInput({ answered_on: "2026-02-29" }).error, /YYYY-MM-DD/);
  assert.equal(parsePrayerInput({ answered_on: "2024-02-29" }).value.answered_on, "2024-02-29");
  assert.equal(parsePrayerInput({ answered_on: "" }).value.answered_on, null);
});

test("edits only return the fields sent", () => {
  assert.deepEqual(parsePrayerInput({ notes: "update" }).value, { notes: "update" });
});

test("views: archived wins, then answered, else active", () => {
  assert.equal(prayerView({ archived_at: "x", answered_on: "2026-01-01" }), "archived");
  assert.equal(prayerView({ answered_on: "2026-01-01" }), "answered");
  assert.equal(prayerView({}), "active");
});
