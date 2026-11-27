import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { documentTitle } from "../utils/documentTitle.js";
import {
  bindSessionAuth,
  isAuthStatus,
  parseFetchError,
  SESSION_ENDED_MESSAGE,
  settleLoadError,
  SIGN_IN_MESSAGE,
} from "../utils/parseFetchError.js";
import { physicalSidebarGroups, physicalTabsForPath } from "../utils/physicalNav.js";
import { taxYearPath } from "../utils/taxYear.js";

function authError(status) {
  return { statusCode: status, data: { statusMessage: "You must be logged in." } };
}

test("a first-time guest load is empty data, and a write still says to sign in", () => {
  bindSessionAuth(() => ({ signedIn: false, ended: false }));
  for (const status of [401, 403]) {
    const error = authError(status);
    assert.equal(isAuthStatus(error), true);
    assert.equal(parseFetchError(error, "Could not load."), SIGN_IN_MESSAGE);
    assert.notEqual(parseFetchError(error), "");
    assert.deepEqual(settleLoadError(error, "Could not load."), {
      auth: true,
      expired: false,
      message: "",
    });
  }
});

test("a 401 while the client was signed in ends the session once and keeps a message", () => {
  let ended = 0;
  bindSessionAuth(
    () => ({ signedIn: ended === 0, ended: ended > 0 }),
    () => {
      ended += 1;
    },
  );
  const error = authError(401);
  assert.equal(parseFetchError(error), SESSION_ENDED_MESSAGE);
  assert.equal(ended, 1);
  const settled = settleLoadError(error, "Could not load.");
  assert.equal(settled.expired, true);
  assert.equal(settled.message, SESSION_ENDED_MESSAGE);
  assert.notEqual(settled.message, "");
  assert.equal(ended, 1);
  bindSessionAuth(() => ({ signedIn: false, ended: false }));
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

test("the You page hides account controls when there is no session", () => {
  const page = readFileSync(new URL("../pages/account.vue", import.meta.url), "utf8");
  assert.match(page, /Your profile/);
  assert.match(page, /Sign in to manage your profile/);
  assert.doesNotMatch(page, /to="\/login"/);
  assert.match(page, /v-if="auth\.user" class="you-menu/);
  assert.match(page, /v-if="auth\.user" class="you-page__logout"/);
  assert.match(page, /v-if="auth\.user" class="mt-4" aria-labelledby="privacy-and-data-heading"/);
});

test("document titles do not repeat the brand", () => {
  assert.equal(documentTitle("Future Star"), "Future Star");
  assert.equal(documentTitle(""), "Future Star");
  assert.equal(documentTitle(undefined), "Future Star");
  assert.equal(documentTitle("Budget Setup"), "Budget Setup · Future Star");
  assert.equal(documentTitle("Delete your account"), "Delete your account · Future Star");
});

function sourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".nuxt" || name === ".output" || name === "ARCHIVE") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(vue|js|ts)$/.test(name)) out.push(full);
  }
  return out;
}

test("only the header login link navigates to /login", () => {
  const root = fileURLToPath(new URL("..", import.meta.url)).replace(/[/\\]$/, "");
  const allowed = new Set(["layouts/default.vue", "components/MobileIonicShell.vue"]);
  const navigates = /(?:navigateTo|go)\(\s*["'`]\/login|to=["']\/login|href=["']\/login/;
  const offenders = [];
  for (const dir of ["pages", "components", "composables", "stores", "layouts", "utils"]) {
    for (const file of sourceFiles(join(root, dir))) {
      const rel = file.slice(root.length + 1).replaceAll("\\", "/");
      if (allowed.has(rel)) continue;
      const source = readFileSync(file, "utf8");
      if (navigates.test(source)) offenders.push(rel);
    }
  }
  const app = readFileSync(join(root, "app.vue"), "utf8");
  if (navigates.test(app)) offenders.push("app.vue");
  assert.deepEqual(offenders, []);

  const auth = readFileSync(join(root, "stores/auth.js"), "utf8");
  assert.match(auth, /SESSION_ENDED_MESSAGE/);
  assert.doesNotMatch(auth, /navigateTo\(\s*["'`]\/login/);

  const writes = {
    "pages/physical/workouts/index.vue": /saveError\.value = auth\.sessionEnded \? SESSION_ENDED_MESSAGE : SIGN_IN_MESSAGE/,
    "pages/garage/index.vue": /error\.value = SIGN_IN_MESSAGE/,
    "pages/cash_flow_tracker.vue": /txError\.value = auth\.sessionEnded \? SESSION_ENDED_MESSAGE : SIGN_IN_MESSAGE[\s\S]*editTxError\.value = auth\.sessionEnded \? SESSION_ENDED_MESSAGE : SIGN_IN_MESSAGE/,
    "components/EstateDocumentsPanel.vue": /uploadError\.value = SIGN_IN_MESSAGE/,
  };
  for (const [rel, pattern] of Object.entries(writes)) {
    const source = readFileSync(join(root, rel), "utf8");
    assert.match(source, pattern, rel);
    assert.doesNotMatch(source, /navigateTo\(\s*["'`]\/login/, rel);
  }

  const workouts = readFileSync(join(root, "pages/physical/workouts/index.vue"), "utf8");
  assert.match(workouts, /v-if="!editing && \(auth\.user \|\| auth\.sessionEnded\)"/);
  assert.match(workouts, /<WorkoutPlanAssistant v-if="auth\.user \|\| auth\.sessionEnded"/);

  const estate = readFileSync(join(root, "pages/estate_mgmt.vue"), "utf8");
  assert.match(estate, /v-if="canWrite"[\s\S]{0,240}Upload document/);
  assert.match(estate, /:show-add="canWrite"/);

  const tracker = readFileSync(join(root, "pages/cash_flow_tracker.vue"), "utf8");
  assert.match(tracker, /<NuxtLink v-if="canWrite" to="\/cash_flow_mgmt"/);
  assert.match(tracker, /<div v-if="canWrite" class="app-sticky-action">/);
  assert.match(tracker, /<div v-if="canWrite" class="ml-auto flex/);
  assert.match(tracker, /parseFetchError\(err, "Failed to save transactions\."\)/);
  assert.match(tracker, /parseFetchError\(err, "Failed to add transaction\."\)/);
  assert.doesNotMatch(tracker, /csvError\.value = err\?\.message/);

  const shell = readFileSync(join(root, "app.vue"), "utf8");
  assert.match(shell, /sessionEndedMessage/);
  assert.match(shell, /role="alert"/);
});

test("a mid-session 401 keeps open forms and guests do not see write controls", () => {
  const root = fileURLToPath(new URL("..", import.meta.url)).replace(/[/\\]$/, "");
  const read = (rel) => readFileSync(join(root, rel), "utf8");

  const workouts = read("pages/physical/workouts/index.vue");
  assert.match(
    workouts,
    /if \(!userId && auth\.sessionEnded\) \{[\s\S]*?return;[\s\S]*?resetForUserChange\(\)/,
  );
  const draft = read("composables/useWorkoutDraft.js");
  assert.match(draft, /if \(failure\.auth && !failure\.expired\) savedWorkouts\.value = \[\]/);

  const tracker = read("pages/cash_flow_tracker.vue");
  assert.match(tracker, /const canWrite = computed\(\(\) => Boolean\(auth\.user \|\| auth\.sessionEnded\)\)/);
  assert.match(tracker, /if \(auth\.sessionEnded\) \{\s*loadError\.value = "";\s*return;\s*\}/);
  assert.match(tracker, /if \(failure\.expired\) \{\s*loadError\.value = "";\s*return;\s*\}/);
  assert.match(tracker, /<div v-if="canWrite" class="app-sticky-action">/);

  const estate = read("pages/estate_mgmt.vue");
  assert.match(estate, /settleLoadError\(error, ""\)/);
  assert.match(estate, /if \(expired\)/);
  assert.match(estate, /if \(auth\.sessionEnded\) return;/);
  assert.doesNotMatch(estate, /:show-add="Boolean\(auth\.user\)"/);
  const sections = estate.match(/<EstateSection\b/g) || [];
  const shown = estate.match(/:show-add="canWrite"/g) || [];
  assert.equal(shown.length, sections.length);

  const investments = read("pages/investments.vue");
  assert.match(investments, /return parseFetchError\(error, fallback\)/);
  assert.match(investments, /settleLoadError\(error, "Could not load investment holdings\."\)/);

  const modal = read("components/AddEstateRecordModal.vue");
  assert.match(modal, /parseFetchError\(err, "Failed to add asset\."\)/);
  assert.doesNotMatch(modal, /addError\.value = err\?\.data\?\.statusMessage/);
  assert.match(modal, /role="alert"/);

  const gated = [
    "components/NutritionTracker.vue",
    "components/SpiritualMorningPrayer.vue",
    "components/SpiritualEveningExamen.vue",
    "components/SpiritualPrayerList.vue",
    "components/SpiritualWorship.vue",
    "components/SpiritualReadingPlans.vue",
    "pages/garage/[id].vue",
  ];
  for (const rel of gated) {
    assert.match(read(rel), /auth\.user \|\| auth\.sessionEnded/, rel);
  }
  assert.match(read("pages/garage/[id].vue"), /Add Service/);
  assert.match(read("pages/estate_mgmt.vue"), /SIGN_IN_MESSAGE/);
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
