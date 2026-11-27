import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url)).replace(/[/\\]$/, "");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const navigatesToLogin = /(?:navigateTo|go)\(\s*["'`]\/login|to=["']\/login|href=["']\/login/;

test("Import is one menu for checking and credit card files", () => {
  const header = read("components/budget/BudgetTrackerHeader.vue");
  assert.match(header, /class="dropdown dropdown-end import-menu"/);
  assert.match(header, /<summary[^>]*>Import<\/summary>/);
  assert.match(header, /aria-haspopup="menu"/);
  assert.match(header, /role="menuitem"[^>]*>From checking/);
  assert.match(header, /role="menuitem"[^>]*>From a credit card/);
  assert.match(header, /chooseImport\('checking'/);
  assert.match(header, /chooseImport\('credit'/);
  assert.match(header, /startCsvUpload\(kind\)/);
  assert.doesNotMatch(header, /Checking Expenses/);
  assert.doesNotMatch(header, /Credit Expenses/);
});

test("Add replaces the Draft sentence button and keeps the category step", () => {
  const bar = read("components/budget/AddTransactionBar.vue");
  assert.match(bar, /placeholder="Kroger 64\.18 yesterday"/);
  assert.match(bar, /Type a store, amount, and day\. You'll review it before it's saved\./);
  assert.match(bar, /sentenceBusy \? "Adding…" : "Add"/);
  assert.match(bar, /v-if="pendingDraft"/);
  assert.match(bar, />\s*Continue\s*</);
  assert.match(bar, /Pick a category/);
  assert.doesNotMatch(bar, /Drafting/);
  assert.doesNotMatch(bar, />\s*Draft\s*</);
  assert.match(bar, /@submit\.prevent="draftTransaction"/);

  const page = read("pages/cash_flow_tracker.vue");
  assert.match(page, /<div v-if="canWrite" class="app-sticky-action">/);
  assert.match(page, /<AddTransactionBar \/>/);
  assert.match(read("composables/useBudgetTracker.js"), /canWrite = computed\(\(\) => Boolean\(auth\.user \|\| auth\.sessionEnded\)\)/);
});

test("Budget Tracker guests keep write controls hidden and see Please sign in", () => {
  const page = read("pages/cash_flow_tracker.vue");
  assert.match(page, /const signInMessage = SIGN_IN_MESSAGE/);
  assert.match(page, /<p v-else class="mb-4 text-sm text-base-content\/70">\{\{ signInMessage \}\}<\/p>/);
  assert.doesNotMatch(page, navigatesToLogin);

  const header = read("components/budget/BudgetTrackerHeader.vue");
  assert.match(header, /<details v-if="canWrite"/);
  assert.match(header, /v-if="showPlanControl"/);
  assert.match(header, /hidden lg:block/);
  assert.match(header, /to="\/account_map"/);
  assert.match(header, /Edit the plan on Account Map/);
  assert.match(header, /Override for month/);
  assert.match(header, /Matched to this month’s spending/);
  assert.match(header, /Pin for this month/);
  assert.doesNotMatch(header, navigatesToLogin);

  const logic = read("composables/useBudgetTracker.js");
  assert.match(logic, /canWrite = computed\(\(\) => Boolean\(auth\.user \|\| auth\.sessionEnded\)\)/);
  assert.match(logic, /if \(auth\.sessionEnded\) \{\s*loadError\.value = "";\s*return;\s*\}/);
  assert.match(logic, /if \(failure\.expired\) \{\s*loadError\.value = "";\s*return;\s*\}/);
  assert.match(logic, /txError\.value = auth\.sessionEnded \? SESSION_ENDED_MESSAGE : SIGN_IN_MESSAGE/);
  assert.match(logic, /if \(!auth\.user\) \{\s*loading\.value = false;[\s\S]*?budgetOptions\.value = \[\]/);
  assert.doesNotMatch(logic, navigatesToLogin);

  const sections = read("components/budget/BudgetCategorySections.vue");
  assert.match(sections, /title="No budget lines yet\."/);
  assert.match(sections, /:action="canWrite \? 'Add a budget line' : ''"/);
  assert.match(sections, /<EmptyState/);
  assert.doesNotMatch(sections, navigatesToLogin);
});

test("estate guests do not get a document upload prompt, and category submit stays on the page", () => {
  const documents = read("components/EstateDocumentsPanel.vue");
  assert.match(documents, /!auth\.user && !auth\.sessionEnded[\s\S]*\? "No documents yet\."/);
  assert.match(documents, /No documents yet\. Upload a PDF, image, or office file to keep it with this household\./);
  assert.doesNotMatch(documents, navigatesToLogin);

  const categories = read("components/EstateAssetCategoriesPanel.vue");
  assert.match(categories, /error\.value = SIGN_IN_MESSAGE/);
  assert.doesNotMatch(categories, /You must be logged in to submit/);
  assert.doesNotMatch(categories, navigatesToLogin);

  const estate = read("pages/estate_mgmt.vue");
  assert.doesNotMatch(estate, navigatesToLogin);
  const modal = read("components/AddEstateRecordModal.vue");
  assert.doesNotMatch(modal, navigatesToLogin);
});
