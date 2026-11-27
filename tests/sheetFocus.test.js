import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { consumeSheetTrigger, focusSheetControl, rememberSheetTrigger, sheetReturnTarget } from "../utils/sheetFocus.js";

const body = { focus() {} };
const trigger = { focus() {} };
const other = { focus() {} };

test("sheet focus returns to the control that opened it", () => {
  assert.equal(sheetReturnTarget(trigger, other, body), trigger);
  assert.equal(sheetReturnTarget(null, other, body), other);
  assert.equal(sheetReturnTarget(body, other, body), other);
  assert.equal(sheetReturnTarget(null, body, body), null);
  assert.equal(sheetReturnTarget({ tag: "not-focusable" }, null, body), null);

  rememberSheetTrigger(trigger);
  assert.equal(consumeSheetTrigger(other, body), trigger);
  assert.equal(consumeSheetTrigger(other, body), other);

  const page = readFileSync(new URL("../pages/account.vue", import.meta.url), "utf8");
  const sheet = readFileSync(new URL("../components/YouSubpage.vue", import.meta.url), "utf8");
  assert.match(page, /rememberSheetTrigger\(trigger\)/);
  assert.match(page, /focusSheetControl\(trigger\)/);
  assert.doesNotMatch(page, /tabindex="0"/);
  assert.match(sheet, /consumeSheetTrigger\(document\.activeElement, document\.body\)/);
  assert.match(sheet, /focusSheetControl\(trigger\)/);
});

test("focus restore uses the ion-item inner button, then setFocus", () => {
  const button = { focus() { button.focused = true; } };
  const host = { shadowRoot: { querySelector: (sel) => (sel === "button" ? button : null) } };
  assert.equal(focusSheetControl(host), button);
  assert.equal(button.focused, true);

  let setFocusCalls = 0;
  const item = { setFocus() { setFocusCalls += 1; } };
  assert.equal(focusSheetControl(item), item);
  assert.equal(setFocusCalls, 1);
  assert.equal(focusSheetControl(null), null);
});
