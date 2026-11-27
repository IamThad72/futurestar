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

test("opening the same sheet twice restores focus after each dismiss", () => {
  const page = readFileSync(new URL("../pages/account.vue", import.meta.url), "utf8");
  const sheet = readFileSync(new URL("../components/YouSubpage.vue", import.meta.url), "utf8");
  assert.match(page, /<LazyAccountManagementModal v-if="accountSheetMounted"/);
  assert.match(page, /<LazyLinkedAccountsModal v-if="linkedSheetMounted"/);
  assert.match(sheet, /onMounted\(\(\) => \{\s*returnFocus = consumeSheetTrigger\(document\.activeElement, document\.body\);/);
  assert.match(
    sheet,
    /if \(open && wasOpen === false\) \{\s*returnFocus = consumeSheetTrigger\(document\.activeElement, document\.body\);/,
  );

  for (const file of ["components/AccountManagementModal.vue", "components/LinkedAccountsModal.vue"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /<YouSubpage/);
    const row = makeRow(file);
    const dismissals = openAndDismissTwice(row);
    assert.equal(dismissals[0], row.button);
    assert.equal(dismissals[1], row.button);
    assert.equal(row.button.focusCount, 3);
  }
});

function makeRow(label) {
  const button = {
    label,
    focusCount: 0,
    focus() {
      button.focusCount += 1;
    },
  };
  return {
    label,
    shadowRoot: { querySelector: (sel) => (sel === "button" ? button : null) },
    button,
  };
}

/** Same capture order as YouSubpage: onMounted for the first open, the watch when it opens again. */
function openAndDismissTwice(row) {
  const body = {};
  let returnFocus = null;
  let wasOpen;

  function watch(open) {
    if (open && wasOpen === false) {
      returnFocus = consumeSheetTrigger(row, body);
    }
    wasOpen = open;
  }

  function onMounted() {
    returnFocus = consumeSheetTrigger(row, body);
  }

  function onDismiss() {
    const trigger = returnFocus;
    returnFocus = null;
    wasOpen = false;
    return focusSheetControl(trigger);
  }

  function open() {
    rememberSheetTrigger(row);
    focusSheetControl(row);
    watch(true);
  }

  watch(true);
  onMounted();
  const first = onDismiss();
  open();
  const second = onDismiss();
  return [first, second];
}

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
