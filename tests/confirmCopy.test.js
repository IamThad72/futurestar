import assert from "node:assert/strict";
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

test("confirm copy keeps a message when only the header is missing", () => {
  const copy = buildConfirmCopy({
    message: "Delete this journal session? This cannot be undone.",
  });
  assert.equal(copy.header, "Please confirm");
  assert.equal(copy.message, "Delete this journal session? This cannot be undone.");
  assert.equal(copy.confirmText, "OK");
  assert.equal(copy.cancelText, "Cancel");
});
