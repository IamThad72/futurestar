import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

test("Capacitor can transpile capacitor.config.ts with the installed TypeScript", () => {
  const ts = require("typescript");
  assert.match(ts.version, /^5\.9\./);
  assert.equal(typeof ts.transpileModule, "function");
  assert.equal(typeof ts.ModuleKind?.CommonJS, "number");
});
