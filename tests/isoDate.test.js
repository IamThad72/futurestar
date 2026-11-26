import assert from "node:assert/strict";
import test from "node:test";
import { isRealIsoDate } from "../utils/isoDate.js";

test("calendar dates reject days Date would roll over", () => {
  assert.equal(isRealIsoDate("2026-11-22"), true);
  assert.equal(isRealIsoDate("2024-02-29"), true);
  assert.equal(isRealIsoDate("2026-02-29"), false);
  assert.equal(isRealIsoDate("2026-02-31"), false);
  assert.equal(isRealIsoDate("2026-04-31"), false);
  assert.equal(isRealIsoDate("2026-13-01"), false);
  assert.equal(isRealIsoDate("2026-00-10"), false);
  assert.equal(isRealIsoDate("2026-11-00"), false);
  assert.equal(isRealIsoDate("11/22/2026"), false);
  assert.equal(isRealIsoDate("2026-11-22T00:00:00Z"), false);
  assert.equal(isRealIsoDate(""), false);
  assert.equal(isRealIsoDate(null), false);
});
