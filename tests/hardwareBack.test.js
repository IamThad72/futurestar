import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { hardwareBackAction, PRESENTED_OVERLAY_SELECTOR } from "../utils/hardwareBack.js";

test("android back dismisses a presented sheet instead of leaving the page", () => {
  assert.equal(hardwareBackAction(true), "overlay");
  assert.equal(hardwareBackAction(false), "page");

  assert.equal(PRESENTED_OVERLAY_SELECTOR, "ion-modal:not(.overlay-hidden)");
  const plugin = readFileSync(new URL("../plugins/capacitor-hash-router.client.ts", import.meta.url), "utf8");
  assert.match(plugin, /PRESENTED_OVERLAY_SELECTOR/);
  assert.match(plugin, /hardwareBackAction\(hasPresentedOverlay\) === "overlay"/);
  assert.match(plugin, /router\.back\(\)/);
});

test("the phone sheet uses ion-modal so Escape, back, and focus are handled", () => {
  const sheet = readFileSync(new URL("../components/YouSubpage.vue", import.meta.url), "utf8");
  assert.match(sheet, /<ion-modal[^>]*ref="modalRef"[^>]*:is-open="presented"/);
  assert.match(sheet, /dismissModal\(modalRef\.value\)/);
  assert.doesNotMatch(sheet, /querySelectorAll\(|\.remove\(\)|discardSheet/);
  assert.match(sheet, /@didDismiss="onDismiss"/);
  assert.match(sheet, /function onDismiss\(\) \{[\s\S]*presented\.value = false;[\s\S]*emit\("update:modelValue", false\);/);
  assert.doesNotMatch(sheet, /keyboard-close="false"|:keyboard-close="false"/);
  assert.doesNotMatch(sheet, /focus-trap="false"|:focus-trap="false"/);
  assert.doesNotMatch(sheet, /backdrop-dismiss="false"|:backdrop-dismiss="false"/);
  assert.match(sheet, /v-if="modelValue && !mobile"/);
});
