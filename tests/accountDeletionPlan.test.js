import assert from "node:assert/strict";
import test from "node:test";
import { planAccountDeletion } from "../utils/accountDeletionPlan.js";
import {
  HOUSEHOLD_DELETION_POLICY,
  REOWN_HOUSEHOLD_TAX,
  householdKeyForGroup,
  isSafeIdentifier,
} from "../utils/accountDeletionPolicy.js";
import {
  ACCOUNT_DELETED_NOTICE,
  ACCOUNT_DELETED_PENDING_NOTICE,
  rememberAccountDeleted,
  takeAccountDeletedNotice,
} from "../utils/accountDeletedNotice.js";
import { KEPT_ON_DELETE, RETENTION_ON_DELETE, deleteAccountStaticHtml } from "../utils/accountDeletionCopy.js";
import {
  bearerIsFresh,
  deletionAttemptBlocked,
  deletionDialogDismissAllowed,
  nextDialogFocusIndex,
  safeDeleteAccountNext,
} from "../utils/deletionGuards.js";

const owner = { user_id: 1, role: "owner", created_at: "2024-01-01T00:00:00.000Z" };
const earlyMember = { user_id: 2, role: "member", created_at: "2024-02-01T00:00:00.000Z" };
const laterMember = { user_id: 4, role: "member", created_at: "2024-06-01T00:00:00.000Z" };

test("a person who is not in a group is erased on their own", () => {
  assert.deepEqual(planAccountDeletion(7, null), { mode: "solo", newOwnerId: null, reownToUserId: null });
  assert.deepEqual(planAccountDeletion(7, []), { mode: "solo", newOwnerId: null, reownToUserId: null });
  assert.deepEqual(planAccountDeletion(7, [owner]), { mode: "solo", newOwnerId: null, reownToUserId: null });
  assert.deepEqual(planAccountDeletion(0, [owner]), { mode: "solo", newOwnerId: null, reownToUserId: null });
});

test("the only member dissolves the household, owner or not", () => {
  assert.deepEqual(planAccountDeletion(1, [owner], { createdBy: 1 }), {
    mode: "dissolve",
    newOwnerId: null,
    reownToUserId: null,
  });
  assert.deepEqual(planAccountDeletion(2, [{ ...earlyMember, user_id: 2 }], { createdBy: 9 }), {
    mode: "dissolve",
    newOwnerId: null,
    reownToUserId: null,
  });
});

test("a member leaving other people hands shared rows to the owner", () => {
  assert.deepEqual(planAccountDeletion(2, [owner, earlyMember, laterMember], { createdBy: 1 }), {
    mode: "reown",
    newOwnerId: null,
    reownToUserId: 1,
  });
});

test("an owner leaving promotes an existing co-owner before an earlier member", () => {
  const plan = planAccountDeletion(
    1,
    [
      owner,
      earlyMember,
      { user_id: 9, role: "owner", created_at: "2024-08-01T00:00:00.000Z" },
    ],
    { createdBy: 1 },
  );
  assert.deepEqual(plan, { mode: "promote", newOwnerId: 9, reownToUserId: 9 });
});

test("two co-owners: the earlier co-owner is promoted", () => {
  const plan = planAccountDeletion(
    1,
    [
      owner,
      { user_id: 6, role: "owner", created_at: "2024-07-01T00:00:00.000Z" },
      { user_id: 3, role: "owner", created_at: "2024-03-01T00:00:00.000Z" },
      earlyMember,
    ],
    { createdBy: 1 },
  );
  assert.equal(plan.newOwnerId, 3);
});

test("an owner leaving promotes the earliest other member", () => {
  assert.deepEqual(planAccountDeletion(1, [owner, laterMember, earlyMember], { createdBy: 1 }), {
    mode: "promote",
    newOwnerId: 2,
    reownToUserId: 2,
  });
});

test("the same join time keeps the lower user id", () => {
  const sameTime = "2024-03-01T00:00:00.000Z";
  const plan = planAccountDeletion(
    1,
    [
      owner,
      { user_id: 8, role: "member", created_at: sameTime },
      { user_id: 3, role: "member", created_at: sameTime },
    ],
    { createdBy: 1 },
  );
  assert.deepEqual(plan, { mode: "promote", newOwnerId: 3, reownToUserId: 3 });
});

test("a missing owner promotes the earliest other member", () => {
  const plan = planAccountDeletion(4, [earlyMember, laterMember], { createdBy: null });
  assert.deepEqual(plan, { mode: "promote", newOwnerId: 2, reownToUserId: 2 });
});

test("a creator whose role is member still hands off before their row is deleted", () => {
  const plan = planAccountDeletion(
    5,
    [
      { user_id: 5, role: "member", created_at: "2024-01-02T00:00:00.000Z" },
      earlyMember,
    ],
    { createdBy: 5 },
  );
  assert.equal(plan.mode, "promote");
  assert.equal(plan.newOwnerId, 2);
  assert.equal(plan.reownToUserId, 2);
});

test("duplicate member rows keep the earlier join", () => {
  const plan = planAccountDeletion(1, [
    owner,
    { user_id: 2, role: "member", created_at: "2024-05-01T00:00:00.000Z" },
    { user_id: 2, role: "owner", created_at: "2024-01-15T00:00:00.000Z" },
    { user_id: 9, role: "member", created_at: "2024-04-01T00:00:00.000Z" },
  ], { createdBy: 1 });
  assert.equal(plan.newOwnerId, 2);
});

test("invalid member rows are ignored", () => {
  const plan = planAccountDeletion(1, [
    owner,
    { user_id: "nope", role: "owner", created_at: "2020-01-01T00:00:00.000Z" },
    earlyMember,
  ]);
  assert.equal(plan.mode, "promote");
  assert.equal(plan.newOwnerId, 2);
});

test("Date join times sort the same way as ISO strings", () => {
  const plan = planAccountDeletion(1, [
    { ...owner, created_at: new Date("2024-01-01T00:00:00.000Z") },
    { ...laterMember, created_at: new Date("2024-06-01T00:00:00.000Z") },
    { ...earlyMember, created_at: new Date("2024-02-01T00:00:00.000Z") },
  ], { createdBy: 1 });
  assert.equal(plan.newOwnerId, 2);
});

test("the default household policy is keep-shared and tax rows are included", () => {
  assert.equal(HOUSEHOLD_DELETION_POLICY, "keep-shared");
  assert.equal(REOWN_HOUSEHOLD_TAX, true);
  assert.equal(householdKeyForGroup(12), "g:12");
  assert.equal(isSafeIdentifier("tax_household_profiles"), true);
  assert.equal(isSafeIdentifier("Users"), false);
  assert.equal(isSafeIdentifier("groups;drop"), false);
  assert.equal(isSafeIdentifier(""), false);
});

test("deletion guards cover re-auth, throttle, focus, and the login return path", () => {
  assert.equal(deletionAttemptBlocked(4, 0), false);
  assert.equal(deletionAttemptBlocked(5, 0), true);
  assert.equal(deletionAttemptBlocked(0, 30), true);
  assert.equal(safeDeleteAccountNext("/delete-account"), "/delete-account");
  assert.equal(safeDeleteAccountNext("/delete-account/extra"), "");
  assert.equal(safeDeleteAccountNext("//evil.example"), "");
  assert.equal(safeDeleteAccountNext("/today"), "");
  assert.equal(deletionDialogDismissAllowed(false), true);
  assert.equal(deletionDialogDismissAllowed(true), false);
  assert.equal(nextDialogFocusIndex(2, 3, false), 0);
  assert.equal(nextDialogFocusIndex(0, 3, true), 2);
  const now = Date.now();
  const fresh = Buffer.from(JSON.stringify({ iat: Math.floor(now / 1000) })).toString("base64url");
  const stale = Buffer.from(JSON.stringify({ iat: Math.floor(now / 1000) - 600 })).toString("base64url");
  assert.equal(bearerIsFresh(`h.${fresh}.s`, now, 5 * 60 * 1000), true);
  assert.equal(bearerIsFresh(`h.${stale}.s`, now, 5 * 60 * 1000), false);
  assert.equal(bearerIsFresh("not-a-jwt", now, 5 * 60 * 1000), false);
  assert.match(KEPT_ON_DELETE, /household/);
  assert.match(RETENTION_ON_DELETE, /sign-in id/);
  const html = deleteAccountStaticHtml();
  assert.match(html, /id="delete-account-static"/);
  assert.match(html, /Stays with the household/);
  assert.match(html, /What is kept afterwards/);
  assert.match(html, /href="\/login\?next=\/delete-account"/);
});

test("the login notice is one line and is read once", () => {
  const store = new Map();
  const previous = globalThis.sessionStorage;
  globalThis.sessionStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
  try {
    rememberAccountDeleted();
    assert.equal(takeAccountDeletedNotice(), ACCOUNT_DELETED_NOTICE);
    rememberAccountDeleted(true);
    assert.equal(takeAccountDeletedNotice(), ACCOUNT_DELETED_PENDING_NOTICE);
    assert.equal(takeAccountDeletedNotice(), "");
    assert.equal(ACCOUNT_DELETED_NOTICE.includes("\n"), false);
    assert.equal(ACCOUNT_DELETED_PENDING_NOTICE.includes("\n"), false);
  } finally {
    if (previous === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previous;
  }
});
