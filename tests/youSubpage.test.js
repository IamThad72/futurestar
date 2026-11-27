import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("phone You sub-pages start below an ion-header, including the top safe area", () => {
  const sheet = read("components/YouSubpage.vue");
  const css = read("assets/css/main.css");

  assert.match(sheet, /<ion-header/);
  assert.match(sheet, /<ion-content[^>]*:fullscreen="false"/);
  assert.match(sheet, /class="ion-padding you-subpage__content"/);
  assert.match(css, /--ion-safe-area-top:\s*env\(safe-area-inset-top,\s*0px\)/);
  assert.doesNotMatch(css, /\.you-subpage[^{]*\{[^}]*margin-top:/);

  for (const file of ["components/AccountManagementModal.vue", "components/LinkedAccountsModal.vue"]) {
    const source = read(file);
    assert.match(source, /<YouSubpage/);
    assert.doesNotMatch(source, /fixed inset-0/);
  }
});

test("Faith settings stay in the You page flow", () => {
  const you = read("pages/account.vue");
  const faith = read("components/FaithSettings.vue");
  assert.match(you, /<FaithSettings/);
  assert.doesNotMatch(faith, /fixed inset-0/);
  assert.doesNotMatch(faith, /<ion-header/);
});
