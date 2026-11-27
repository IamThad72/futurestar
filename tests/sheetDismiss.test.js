import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dismissModal } from "../utils/sheetDismiss.js";

test("the phone sheet dismisses through the modal ref", async () => {
  let calls = 0;
  const viaElement = dismissModal({ dismiss: () => { calls += 1; return "direct"; } });
  assert.equal(await viaElement, "direct");

  const viaInstance = dismissModal({ $el: { dismiss: () => { calls += 1; return "el"; } } });
  assert.equal(await viaInstance, "el");
  assert.equal(calls, 2);
  assert.equal(dismissModal(null), undefined);
  assert.equal(dismissModal({}), undefined);

  const sheet = readFileSync(new URL("../components/YouSubpage.vue", import.meta.url), "utf8");
  assert.match(sheet, /ref="modalRef"/);
  assert.match(sheet, /dismissModal\(modalRef\.value\)/);
  assert.doesNotMatch(sheet, /querySelectorAll\(|\.remove\(\)|discardSheet/);
});
