import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildConfirmCopy } from "../utils/confirmCopy.js";

test("confirm copy trims each field", () => {
  const copy = buildConfirmCopy({
    header: "  Delete workout? \n",
    message: "  Delete this workout? This cannot be undone.  ",
    confirmText: "  Delete  ",
    cancelText: "  Cancel  ",
  });
  assert.deepEqual(copy, {
    header: "Delete workout?",
    message: "Delete this workout? This cannot be undone.",
    confirmText: "Delete",
    cancelText: "Cancel",
  });
});

test("confirm copy falls back when fields are blank", () => {
  const copy = buildConfirmCopy({
    header: "   ",
    message: "\n",
    confirmText: "",
    cancelText: null,
  });
  assert.deepEqual(copy, {
    header: "Please confirm",
    message: "",
    confirmText: "OK",
    cancelText: "Cancel",
  });
});

test("alert text keeps quotes and markup characters as plain text", () => {
  const copy = buildConfirmCopy({
    header: 'Delete "prayer"?',
    message: 'Delete "Mom & Dad" <today>?',
  });
  assert.equal(copy.header, 'Delete "prayer"?');
  assert.equal(copy.message, 'Delete "Mom & Dad" <today>?');
  assert.doesNotMatch(`${copy.header} ${copy.message}`, /&quot;|&amp;|&lt;|&gt;/);
});

test("the confirm dialog does not escape text or fall back to the browser", () => {
  const source = readFileSync(new URL("../composables/useConfirm.js", import.meta.url), "utf8");
  assert.equal(source.includes("escapeHtml"), false);
  assert.equal(source.includes("window.confirm"), false);
});

test("confirm copy keeps a message when only the header is missing", () => {
  const copy = buildConfirmCopy({
    message: "Delete this journal session? This cannot be undone.",
  });
  assert.equal(copy.header, "Please confirm");
  assert.equal(copy.message, "Delete this journal session? This cannot be undone.");
  assert.equal(copy.confirmText, "OK");
  assert.equal(copy.cancelText, "Cancel");
});
