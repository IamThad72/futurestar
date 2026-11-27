import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isAuthStatus, parseFetchError, settleLoadError } from "../utils/parseFetchError.js";
import { physicalSidebarGroups, physicalTabsForPath } from "../utils/physicalNav.js";
import { taxYearPath } from "../utils/taxYear.js";

function authError(status) {
  return { statusCode: status, data: { statusMessage: "You must be logged in." } };
}

test("401 and 403 settle to empty data instead of an error message", () => {
  for (const status of [401, 403]) {
    const error = authError(status);
    assert.equal(isAuthStatus(error), true);
    assert.equal(parseFetchError(error, "Could not load."), "");
    assert.deepEqual(settleLoadError(error, "Could not load."), { auth: true, message: "" });
  }
});

test("network and server failures stay errors for LoadErrorPanel", () => {
  const offline = { name: "FetchError", message: "Failed to fetch" };
  assert.equal(isAuthStatus(offline), false);
  assert.match(parseFetchError(offline), /Can't reach the server/);
  assert.equal(settleLoadError(offline).auth, false);
  assert.match(settleLoadError(offline).message, /Can't reach the server/);

  const server = { statusCode: 500, data: { statusMessage: "Database unavailable." } };
  assert.equal(parseFetchError(server, "Try again."), "Database unavailable.");
  assert.equal(settleLoadError(server, "Try again.").auth, false);
});

test("tax index follows the current year", () => {
  assert.equal(taxYearPath(new Date("2026-11-27T12:00:00Z")), "/tax/2026");
  assert.equal(taxYearPath(new Date("2027-01-02T12:00:00Z")), "/tax/2027");
  const page = readFileSync(new URL("../pages/tax/index.vue", import.meta.url), "utf8");
  assert.match(page, /taxYearPath\(/);
  assert.doesNotMatch(page, /\/tax\/2026/);
});

test("Body sidebar splits journals and plans", () => {
  const groups = physicalSidebarGroups(physicalTabsForPath("/physical"));
  assert.deepEqual(
    groups.map((group) => group.name),
    ["Journals", "Plans"],
  );
  assert.deepEqual(
    groups[0].tabs.map((tab) => tab.name),
    ["Nutrition Journal", "Exercise Journal"],
  );
  assert.deepEqual(
    groups[1].tabs.map((tab) => tab.name),
    ["Workout Manager"],
  );
});

test("named loaders map anonymous responses through settleLoadError", () => {
  const files = [
    "composables/useEstateSummary.js",
    "composables/useBudgetChartData.js",
    "composables/useWorkoutDraft.js",
    "components/NutritionTracker.vue",
    "components/SpiritualPrayerList.vue",
    "components/SpiritualReadingPlans.vue",
    "components/SpiritualScripture.vue",
    "components/SpiritualWorship.vue",
    "components/SpiritualMorningPrayer.vue",
    "components/SpiritualEveningExamen.vue",
    "components/TodayReadingCard.vue",
  ];
  for (const file of files) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /settleLoadError\(/, file);
  }
});
