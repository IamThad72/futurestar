import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runGuardedSignOut } from "../utils/signOutGuard.js";

test("logout ignores a second tap while sign-out is running and re-enables after failure", async () => {
  const page = readFileSync(new URL("../pages/account.vue", import.meta.url), "utf8");
  assert.match(page, /:disabled="signingOut"/);
  assert.match(page, /runGuardedSignOut\(signingOut,\s*signOut\)/);

  const signingOut = { value: false };
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });

  const first = runGuardedSignOut(signingOut, () => {
    calls += 1;
    return gate;
  });
  const second = await runGuardedSignOut(signingOut, () => {
    calls += 1;
    return Promise.resolve();
  });

  assert.equal(signingOut.value, true);
  assert.equal(second, false);
  assert.equal(calls, 1);
  release();
  assert.equal(await first, true);
  assert.equal(signingOut.value, true);

  signingOut.value = false;
  await assert.rejects(
    runGuardedSignOut(signingOut, async () => {
      throw new Error("sign-out failed");
    }),
    /sign-out failed/,
  );
  assert.equal(signingOut.value, false);
});
