import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("phone You sub-pages start below an ion-header, including the top safe area", () => {
  const sheet = read("components/YouSubpage.vue");
  const css = read("assets/css/main.css");

  assert.match(sheet, /<ion-modal/);
  assert.match(sheet, /<ion-header/);
  assert.match(sheet, /<ion-content[^>]*:fullscreen="false"/);
  assert.match(sheet, /class="ion-padding you-subpage__content"/);
  assert.match(sheet, /@didDismiss="onDismiss"/);
  assert.match(sheet, /v-if="modelValue && !mobile"/);
  assert.doesNotMatch(sheet, /<Teleport[^>]+to="#main-content"/);
  assert.doesNotMatch(sheet, /keyboard-close="false"|:keyboard-close="false"/);
  assert.doesNotMatch(sheet, /focus-trap="false"|:focus-trap="false"/);
  assert.doesNotMatch(sheet, /backdrop-dismiss="false"|:backdrop-dismiss="false"/);
  for (const side of ["top", "right", "bottom", "left"]) {
    assert.match(
      css,
      new RegExp(`--ion-safe-area-${side}:\\s*var\\(--safe-area-inset-${side},\\s*env\\(safe-area-inset-${side}\\)\\)`),
    );
  }
  assert.doesNotMatch(css, /--ion-safe-area-(?:top|right|bottom|left):\s*env\(/);
  assert.match(css, /--padding-bottom:\s*var\(--ion-padding,\s*16px\)/);
  assert.doesNotMatch(css, /--padding-bottom:\s*calc\(/);
  assert.match(css, /--padding-start:\s*calc\(var\(--you-subpage-pad\) \+ var\(--you-subpage-safe-start\)\)/);
  assert.match(css, /--padding-end:\s*calc\(var\(--you-subpage-pad\) \+ var\(--you-subpage-safe-end\)\)/);
  assert.doesNotMatch(css, /calc\([^;]*var\([^)]*,\s*var\(/);
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
