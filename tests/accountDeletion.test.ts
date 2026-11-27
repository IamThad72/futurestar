import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "../server/utils/password";
import deleteAccount from "../server/api/auth/delete-account.post";
import accountCleanup from "../server/api/cron/account-cleanup.get";
import { deletionIpHash, deletionLogRef } from "../server/utils/accountDeletion";
import { supabasePasswordMatches } from "../server/utils/supabasePassword";
import { makeEvent } from "./helpers/event";
import { AccountDeletionDb, type AccountUser } from "./helpers/accountDeletionDb";

vi.mock("../server/utils/db", () => ({
  createDbClient: () => {
    const db = (globalThis as { __accountDeletionDb?: { client: () => unknown } }).__accountDeletionDb;
    if (!db) throw new Error("Account deletion test database is not initialized.");
    return db.client();
  },
}));

vi.mock("../server/utils/superbase", () => ({
  supabase: {
    auth: {
      getUser: async (jwt: string) => {
        const db = (globalThis as { __accountDeletionDb?: { supabaseIdForJwt: (token: string) => string | null } }).__accountDeletionDb;
        const id = db?.supabaseIdForJwt(jwt);
        if (!id) return { data: { user: null }, error: { message: "invalid jwt" } };
        return { data: { user: { id } }, error: null };
      },
    },
  },
}));

vi.mock("../server/utils/supabaseAdmin", () => ({
  getSupabaseAdmin: () =>
    (globalThis as { __supabaseAdmin?: { auth: { admin: { deleteUser: (id: string, soft?: boolean) => Promise<{ error: { message: string } | null }> } } } | null }).__supabaseAdmin ?? null,
}));

vi.mock("../server/utils/supabasePassword", () => ({
  supabasePasswordMatches: vi.fn(async (email: string, password: string) => {
    const accepted = (globalThis as { __supabasePasswords?: Record<string, string> }).__supabasePasswords ?? {};
    return accepted[email] === password;
  }),
}));

vi.mock("../server/utils/estateDocuments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/utils/estateDocuments")>();
  return {
    ...actual,
    removeEstateFile: async (storagePath: string, backend: string) => {
      const state = globalThis as { __removedEstateFiles?: Array<{ path: string; backend: string }>; __failEstateRemove?: boolean };
      state.__removedEstateFiles?.push({ path: storagePath, backend });
      if (state.__failEstateRemove) throw new Error("disk full");
    },
  };
});

type HandlerEvent = ReturnType<typeof makeEvent>;

const PASSWORD = "correct-horse";
let passwordHash = "";

function globals() {
  return globalThis as {
    __accountDeletionDb?: AccountDeletionDb;
    __removedEstateFiles?: Array<{ path: string; backend: string }>;
    __failEstateRemove?: boolean;
    __supabaseAdmin?: { auth: { admin: { deleteUser: ReturnType<typeof vi.fn> } } } | null;
  };
}

function install(db: AccountDeletionDb) {
  const state = globals();
  state.__accountDeletionDb = db;
  state.__removedEstateFiles = [];
  state.__failEstateRemove = false;
  state.__supabaseAdmin = {
    auth: {
      admin: {
        deleteUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      },
    },
  };
  return db;
}

function user(partial: Partial<AccountUser> & Pick<AccountUser, "user_id" | "email">): AccountUser {
  return {
    display_name: null,
    profile_photo: null,
    password_hash: passwordHash,
    supabase_user_id: `sb-${partial.user_id}`,
    ...partial,
  };
}

function later() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function bearerJwt(iatSeconds: number) {
  const payload = Buffer.from(JSON.stringify({ iat: iatSeconds })).toString("base64url");
  return `header.${payload}.sig`;
}

function session(db: AccountDeletionDb, userId: number, token: string) {
  db.sessions.push({ session_token: token, user_id: userId, expires_at: later() });
}

async function call(db: AccountDeletionDb, options: { cookie?: string; jwt?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.cookie) headers.cookie = `session=${options.cookie}`;
  if (options.jwt) headers.authorization = `Bearer ${options.jwt}`;
  const event = makeEvent({
    method: "POST",
    url: "/api/auth/delete-account",
    headers,
    body: options.body ?? {},
  });
  const value = await (deleteAccount as (event: HandlerEvent) => Promise<{ success: boolean; authUserRemoved: boolean; authRemovalPending: boolean }>)(event);
  return { value, event };
}

async function expectStatus(promise: Promise<unknown>, statusCode: number, statusMessage?: string) {
  try {
    const value = await promise;
    throw new Error(`expected HTTP ${statusCode} but the handler resolved: ${JSON.stringify(value)}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("expected HTTP")) throw error;
    expect(error).toMatchObject({ statusCode });
    if (statusMessage) expect((error as { statusMessage?: string }).statusMessage).toBe(statusMessage);
  }
}

function cookieHeader(event: HandlerEvent) {
  const header = event.node.res.getHeader("set-cookie");
  return Array.isArray(header) ? header.join(" ") : String(header ?? "");
}

beforeAll(() => {
  passwordHash = hashPassword(PASSWORD);
});

beforeEach(() => {
  install(new AccountDeletionDb());
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("delete account authentication and IDOR", () => {
  it("rejects an anonymous caller and an unknown session", async () => {
    const db = install(new AccountDeletionDb());
    db.users.push(user({ user_id: 1, email: "a@example.com" }));
    await expectStatus(call(db).then((item) => item.value), 401, "You must be logged in.");
    await expectStatus(call(db, { cookie: "missing" }).then((item) => item.value), 401, "You must be logged in.");
    expect(db.users).toHaveLength(1);
    expect(globals().__removedEstateFiles).toEqual([]);
  });

  it("rejects a mismatched email or password and deletes nothing", async () => {
    const db = install(new AccountDeletionDb());
    db.users.push(user({ user_id: 1, email: "Ada@Example.com" }));
    session(db, 1, "session-a");
    db.rows.prayer_requests.push({ prayer_id: 1, user_id: 1, title: "Keep me" });

    await expectStatus(
      call(db, { cookie: "session-a", body: { confirmEmail: "other@example.com", password: PASSWORD } }).then((item) => item.value),
      400,
      "Type your account email to confirm.",
    );
    await expectStatus(
      call(db, { cookie: "session-a", body: { confirmEmail: "ada@example.com" } }).then((item) => item.value),
      400,
      "Enter your password to confirm.",
    );
    await expectStatus(
      call(db, { cookie: "session-a", body: { confirmEmail: "ada@example.com", password: "wrong" } }).then((item) => item.value),
      400,
      "Enter your password to confirm.",
    );
    db.users[0]!.password_hash = "310000:aa:abcd";
    await expectStatus(
      call(db, { cookie: "session-a", body: { confirmEmail: "ada@example.com", password: PASSWORD } }).then((item) => item.value),
      400,
      "Enter your password to confirm.",
    );
    db.users[0]!.password_hash = passwordHash;

    expect(db.users).toHaveLength(1);
    expect(db.rows.prayer_requests).toHaveLength(1);
    expect(globals().__removedEstateFiles).toEqual([]);
  });

  it("ignores a user id in the body and deletes only the session user", async () => {
    const db = install(new AccountDeletionDb());
    db.users.push(user({ user_id: 1, email: "a@example.com" }), user({ user_id: 2, email: "b@example.com" }));
    session(db, 1, "session-a");
    session(db, 2, "session-b");
    db.rows.budgets.push(
      { budget_id: 1, user_id: 1, group_id: null, name: "Ada" },
      { budget_id: 2, user_id: 2, group_id: null, name: "Bea" },
    );
    db.rows.prayer_requests.push(
      { prayer_id: 1, user_id: 1, title: "Ada prayer" },
      { prayer_id: 2, user_id: 2, title: "Bea prayer" },
    );

    const { value, event } = await call(db, {
      cookie: "session-a",
      body: { confirmEmail: "a@example.com", password: PASSWORD, userId: 2, user_id: 2 },
    });

    expect(value).toEqual({ success: true, authUserRemoved: true, authRemovalPending: false });
    expect(cookieHeader(event)).toContain("session=");
    expect(cookieHeader(event).toLowerCase()).toContain("max-age=0");
    expect(db.users.map((item) => item.user_id)).toEqual([2]);
    expect(db.sessions.map((item) => item.user_id)).toEqual([2]);
    expect(db.rows.budgets.map((item) => item.user_id)).toEqual([2]);
    expect(db.rows.prayer_requests.map((item) => item.user_id)).toEqual([2]);
    expect(globals().__supabaseAdmin?.auth.admin.deleteUser).toHaveBeenCalledWith("sb-1", false);

    await expectStatus(
      call(db, { cookie: "session-a", body: { confirmEmail: "a@example.com", password: PASSWORD } }).then((item) => item.value),
      401,
      "You must be logged in.",
    );
    await expectStatus(
      call(db, { cookie: "session-b", body: { confirmEmail: "a@example.com", password: PASSWORD, userId: 1 } }).then((item) => item.value),
      400,
      "Type your account email to confirm.",
    );
    expect(db.users.map((item) => item.user_id)).toEqual([2]);
  });
});

describe("household deletion", () => {
  function household(db: AccountDeletionDb) {
    db.users.push(
      user({ user_id: 1, email: "owner@example.com" }),
      user({ user_id: 2, email: "member@example.com" }),
      user({ user_id: 4, email: "former@example.com" }),
    );
    session(db, 1, "session-owner");
    session(db, 2, "session-member");
    db.groups.push({ group_id: 10, group_name: "Home", created_by: 1 });
    db.members.push(
      { group_id: 10, user_id: 1, role: "owner", created_at: "2024-01-01T00:00:00.000Z" },
      { group_id: 10, user_id: 2, role: "member", created_at: "2024-02-01T00:00:00.000Z" },
    );
    db.rows.budgets.push(
      { budget_id: 1, user_id: 1, group_id: 10, name: "Shared" },
      { budget_id: 2, user_id: 2, group_id: null, name: "Solo" },
    );
    db.rows.budget_transactions.push({
      transaction_id: 1,
      user_id: 2,
      group_id: 10,
      amount: 25,
      income_source_id: 2,
    });
    db.rows.estate_documents.push(
      { doc_id: 1, user_id: 2, group_id: 10, storage_path: "group/keep", storage_backend: "supabase", original_filename: "secret-will.pdf" },
      { doc_id: 2, user_id: 2, group_id: null, storage_path: "solo/remove", storage_backend: "disk", original_filename: "secret-will.pdf" },
    );
    db.rows.income_sources.push(
      { source_id: 1, user_id: 1, group_id: 10, name: "Pay" },
      { source_id: 2, user_id: 2, group_id: 10, name: "Pay" },
      { source_id: 3, user_id: 2, group_id: 10, name: "Bonus" },
    );
    db.rows.record_shares = [
      {
        share_id: 1,
        record_type: "income_source",
        record_id: 2,
        owner_user_id: 2,
        shared_user_id: 1,
      },
    ];
    db.rows.prayer_requests.push(
      { prayer_id: 1, user_id: 1, title: "Owner prayer" },
      { prayer_id: 2, user_id: 2, title: "Member prayer" },
    );
    db.rows.workouts.push({ workout_id: 2, user_id: 2, name: "Run" });
    db.rows.nutrition_intake_entries.push({ entry_id: 2, user_id: 2, food_name: "Oats" });
    db.rows.tax_household_profiles.push({ profile_id: 1, user_id: 2, group_id: 10, household_key: "g:10", tax_year: 2026 });
    db.rows.tax_deduction_overrides.push({ override_id: 1, user_id: 2, household_key: "g:10", category: "Giving" });
  }

  it("re-owns a member's household rows and erases their private rows", async () => {
    const db = install(new AccountDeletionDb());
    household(db);

    const { value } = await call(db, {
      cookie: "session-member",
      body: { confirmEmail: "member@example.com", password: PASSWORD },
    });

    expect(value.success).toBe(true);
    expect(db.users.map((item) => item.user_id).sort()).toEqual([1, 4]);
    expect(db.groups).toEqual([{ group_id: 10, group_name: "Home", created_by: 1 }]);
    expect(db.members.map((item) => item.user_id)).toEqual([1]);
    expect(db.members[0]?.role).toBe("owner");
    expect(db.rows.budgets.map((item) => item.budget_id)).toEqual([1]);
    expect(db.rows.budget_transactions[0]).toMatchObject({
      user_id: 1,
      group_id: 10,
      amount: 25,
      income_source_id: 2,
    });
    expect(db.rows.estate_documents).toEqual([
      expect.objectContaining({ storage_path: "group/keep", user_id: 1, group_id: 10 }),
    ]);
    expect(db.rows.income_sources.map((item) => `${item.source_id}:${item.user_id}:${item.name}`).sort()).toEqual([
      "1:1:Pay",
      "2:1:Pay (former member)",
      "3:1:Bonus",
    ]);
    expect(db.rows.record_shares).toEqual([]);
    expect(db.queries.some((query) => query.toLowerCase().includes("record_shares"))).toBe(false);
    expect(db.rows.tax_household_profiles[0]).toMatchObject({ user_id: 1, group_id: 10, household_key: "g:10" });
    expect(db.rows.tax_deduction_overrides[0]).toMatchObject({ user_id: 1, household_key: "g:10" });
    expect(db.rows.prayer_requests.map((item) => item.user_id)).toEqual([1]);
    expect(db.rows.workouts).toEqual([]);
    expect(db.rows.nutrition_intake_entries).toEqual([]);
    expect(globals().__removedEstateFiles).toEqual([{ path: "solo/remove", backend: "disk" }]);
    const logged = vi.mocked(console.error).mock.calls.map((args) => JSON.stringify(args)).join(" ");
    expect(logged).not.toContain("secret-will.pdf");
    expect(logged).not.toContain("member@example.com");
  });

  it("numbers the renamed source when that name is already taken and keeps the transaction link", async () => {
    const db = install(new AccountDeletionDb());
    household(db);
    db.rows.income_sources.push({
      source_id: 4,
      user_id: 1,
      group_id: 10,
      name: "Pay (former member)",
    });

    await call(db, {
      cookie: "session-member",
      body: { confirmEmail: "member@example.com", password: PASSWORD },
    });

    expect(db.rows.income_sources.find((item) => item.source_id === 2)).toMatchObject({
      user_id: 1,
      name: "Pay (former member) 2",
    });
    expect(db.rows.income_sources.find((item) => item.source_id === 1)?.name).toBe("Pay");
    expect(db.rows.budget_transactions[0]?.income_source_id).toBe(2);
    expect(db.rows.record_shares).toEqual([]);
    expect(db.queries.some((query) => query.toLowerCase().includes("record_shares"))).toBe(false);
  });

  it("promotes the other member when the owner leaves", async () => {
    const db = install(new AccountDeletionDb());
    household(db);
    db.rows.estate_documents.push({
      doc_id: 3,
      user_id: 1,
      group_id: null,
      storage_path: "owner/solo",
      storage_backend: "disk",
      original_filename: "secret-will.pdf",
    });

    const { value } = await call(db, {
      cookie: "session-owner",
      body: { confirmEmail: "owner@example.com", password: PASSWORD },
    });

    expect(value.success).toBe(true);
    expect(db.groups[0]).toMatchObject({ group_id: 10, created_by: 2 });
    expect(db.members).toEqual([
      expect.objectContaining({ user_id: 2, role: "owner" }),
    ]);
    expect(db.rows.budgets[0]).toMatchObject({ user_id: 2, group_id: 10, name: "Shared" });
    expect(db.rows.prayer_requests.map((item) => item.title)).toEqual(["Member prayer"]);
    expect(db.users.map((item) => item.user_id)).toContain(2);
    expect(globals().__removedEstateFiles).toEqual([{ path: "owner/solo", backend: "disk" }]);
  });

  it("deletes the household when the last member leaves", async () => {
    const db = install(new AccountDeletionDb());
    household(db);
    db.members = db.members.filter((item) => item.user_id === 1);
    db.rows.budgets.push({ budget_id: 9, user_id: 4, group_id: 10, name: "Left behind" });
    db.rows.prayer_requests.push({ prayer_id: 4, user_id: 4, title: "Former prayer" });

    const { value } = await call(db, {
      cookie: "session-owner",
      body: { confirmEmail: "owner@example.com", password: PASSWORD },
    });

    expect(value.success).toBe(true);
    expect(db.groups).toEqual([]);
    expect(db.members).toEqual([]);
    expect(db.rows.budgets).toEqual([expect.objectContaining({ budget_id: 2, user_id: 2, group_id: null, name: "Solo" })]);
    expect(db.rows.budgets.find((item) => item.budget_id === 9)).toBeUndefined();
    expect(db.rows.budget_transactions).toEqual([]);
    expect(db.rows.estate_documents).toEqual([
      expect.objectContaining({ storage_path: "solo/remove", user_id: 2, group_id: null }),
    ]);
    expect(db.rows.tax_household_profiles).toEqual([]);
    expect(db.rows.tax_deduction_overrides).toEqual([]);
    expect(db.rows.prayer_requests.map((item) => item.title).sort()).toEqual(["Former prayer", "Member prayer"]);
    expect(db.users.map((item) => item.user_id).sort()).toEqual([2, 4]);
    expect(globals().__removedEstateFiles).toEqual([
      { path: "group/keep", backend: "supabase" },
    ]);
  });

  it("rolls back the handoff when the user delete fails", async () => {
    const db = install(new AccountDeletionDb());
    household(db);
    db.failDeleteUser = true;

    await expectStatus(
      call(db, { cookie: "session-member", body: { confirmEmail: "member@example.com", password: PASSWORD } }).then((item) => item.value),
      500,
      "Could not delete the account.",
    );

    expect(db.users.map((item) => item.user_id).sort()).toEqual([1, 2, 4]);
    expect(db.rows.budget_transactions[0]).toMatchObject({ user_id: 2, group_id: 10 });
    expect(db.rows.prayer_requests.map((item) => item.user_id).sort()).toEqual([1, 2]);
    expect(db.groups[0]?.created_by).toBe(1);
    expect(globals().__removedEstateFiles).toEqual([]);
    expect(globals().__supabaseAdmin?.auth.admin.deleteUser).not.toHaveBeenCalled();
  });
});

describe("auth user and storage cleanup", () => {
  it("deletes a Supabase-only account from a bearer token without a password", async () => {
    const db = install(new AccountDeletionDb());
    db.users.push(user({ user_id: 3, email: "mobile@example.com", password_hash: null, supabase_user_id: "sb-mobile" }));
    const token = bearerJwt(Math.floor(Date.now() / 1000));
    db.trustJwt(token, "sb-mobile");
    (globalThis as { __supabasePasswords?: Record<string, string> }).__supabasePasswords = { "mobile@example.com": PASSWORD };
    db.rows.workouts.push({ workout_id: 3, user_id: 3, name: "Lift" });

    await expectStatus(
      call(db, { jwt: token, body: { confirmEmail: "mobile@example.com", password: "" } }).then((item) => item.value),
      400,
      "Enter your password to confirm.",
    );
    expect(db.users).toHaveLength(1);

    const { value } = await call(db, {
      jwt: token,
      body: { confirmEmail: "mobile@example.com", password: PASSWORD },
    });

    expect(value).toEqual({ success: true, authUserRemoved: true, authRemovalPending: false });
    expect(db.users).toEqual([]);
    expect(db.rows.workouts).toEqual([]);
    expect(globals().__supabaseAdmin?.auth.admin.deleteUser).toHaveBeenCalledWith("sb-mobile", false);
  });

  it("still succeeds when auth deletion or file removal fails", async () => {
    const db = install(new AccountDeletionDb());
    db.users.push(user({ user_id: 1, email: "a@example.com", supabase_user_id: "sb-a" }));
    session(db, 1, "session-a");
    db.rows.estate_documents.push({
      doc_id: 1,
      user_id: 1,
      group_id: null,
      storage_path: "solo/remove",
      storage_backend: "disk",
      original_filename: "secret-will.pdf",
    });
    globals().__failEstateRemove = true;
    globals().__supabaseAdmin!.auth.admin.deleteUser.mockResolvedValue({ data: null, error: { message: "a@example.com gone" } });

    const { value } = await call(db, {
      cookie: "session-a",
      body: { confirmEmail: "a@example.com", password: PASSWORD },
    });

    expect(value).toEqual({ success: true, authUserRemoved: false, authRemovalPending: true });
    expect(db.users).toEqual([]);
    expect(db.rows.deleted_auth_users[0]).toMatchObject({ supabase_user_id: "sb-a", auth_deleted_at: null });
    expect(Number(db.rows.deleted_auth_users[0]?.attempt_count)).toBeGreaterThan(0);
    expect(db.rows.pending_storage_deletes[0]).toMatchObject({ storage_path: "solo/remove", deleted_at: null });
    const logged = vi.mocked(console.error).mock.calls.map((args) => JSON.stringify(args)).join(" ");
    expect(logged).toContain("disk");
    expect(logged).toContain(deletionLogRef("sb-a"));
    expect(logged).toContain(deletionLogRef("solo/remove"));
    expect(logged).not.toContain("sb-a");
    expect(logged).not.toContain("solo/remove");
    expect(logged).not.toContain("a@example.com");
    expect(logged).not.toContain("secret-will.pdf");
    expect(logged).not.toContain("userId");
  });

  it("succeeds when no service-role client and no Supabase user are configured", async () => {
    const db = install(new AccountDeletionDb());
    db.users.push(user({ user_id: 1, email: "a@example.com", supabase_user_id: null }));
    session(db, 1, "session-a");
    globals().__supabaseAdmin = null;

    const { value } = await call(db, {
      cookie: "session-a",
      body: { confirmEmail: "A@EXAMPLE.COM", password: PASSWORD },
    });

    expect(value).toEqual({ success: true, authUserRemoved: false, authRemovalPending: false });
    expect(db.users).toEqual([]);
  });

  it("rejects a stale Supabase token and a wrong Supabase password", async () => {
    const db = install(new AccountDeletionDb());
    db.users.push(user({ user_id: 3, email: "mobile@example.com", password_hash: null, supabase_user_id: "sb-mobile" }));
    (globalThis as { __supabasePasswords?: Record<string, string> }).__supabasePasswords = { "mobile@example.com": PASSWORD };
    const stale = bearerJwt(Math.floor(Date.now() / 1000) - 600);
    db.trustJwt(stale, "sb-mobile");
    vi.mocked(supabasePasswordMatches).mockClear();

    await expectStatus(
      call(db, { jwt: stale, body: { confirmEmail: "mobile@example.com", password: PASSWORD } }).then((item) => item.value),
      401,
      "Sign in again to delete your account.",
    );
    expect(db.users).toHaveLength(1);
    expect(db.queries.some((query) => query === "BEGIN")).toBe(false);
    expect(supabasePasswordMatches).not.toHaveBeenCalled();

    const fresh = bearerJwt(Math.floor(Date.now() / 1000));
    db.trustJwt(fresh, "sb-mobile");
    await expectStatus(
      call(db, { jwt: fresh, body: { confirmEmail: "mobile@example.com", password: "nope" } }).then((item) => item.value),
      400,
      "Enter your password to confirm.",
    );
    expect(db.users).toHaveLength(1);
    expect(db.rows.account_deletion_attempts.length).toBeGreaterThan(0);
  });
});

describe("throttle, households, and handoff details", () => {
  it("records a failed password without deleting the account", async () => {
    const db = install(new AccountDeletionDb());
    db.users.push(user({ user_id: 1, email: "a@example.com" }));
    session(db, 1, "session-a");
    await expectStatus(
      call(db, { cookie: "session-a", body: { confirmEmail: "a@example.com", password: "wrong" } }).then((item) => item.value),
      400,
    );
    expect(db.queries.some((query) => query.includes("DELETE FROM app_users"))).toBe(false);
    expect(db.queries.some((query) => query.includes("pg_advisory_xact_lock"))).toBe(true);
    expect(db.rows.account_deletion_attempts).toHaveLength(1);
    expect(db.users).toHaveLength(1);
  });

  it("stops further attempts after the per-user limit, even with the right password", async () => {
    const db = install(new AccountDeletionDb());
    db.users.push(user({ user_id: 1, email: "a@example.com" }));
    session(db, 1, "session-a");
    for (let i = 0; i < 5; i += 1) {
      await expectStatus(
        call(db, { cookie: "session-a", body: { confirmEmail: "a@example.com", password: "wrong" } }).then((item) => item.value),
        400,
      );
    }
    await expectStatus(
      call(db, { cookie: "session-a", body: { confirmEmail: "a@example.com", password: PASSWORD } }).then((item) => item.value),
      429,
      "Too many attempts. Try again later.",
    );
    expect(db.users).toHaveLength(1);
    expect(db.queries.some((query) => query.includes("DELETE FROM app_users"))).toBe(false);
  });

  it("refuses to delete an account that is already in two households", async () => {
    const db = install(new AccountDeletionDb());
    db.users.push(user({ user_id: 1, email: "a@example.com" }));
    session(db, 1, "session-a");
    db.groups.push(
      { group_id: 10, group_name: "Home", created_by: 1 },
      { group_id: 11, group_name: "Other", created_by: 1 },
    );
    db.members.push(
      { group_id: 10, user_id: 1, role: "owner", created_at: "2024-01-01T00:00:00.000Z" },
      { group_id: 11, user_id: 1, role: "member", created_at: "2024-02-01T00:00:00.000Z" },
    );
    await expectStatus(
      call(db, { cookie: "session-a", body: { confirmEmail: "a@example.com", password: PASSWORD } }).then((item) => item.value),
      409,
      "This account is in more than one household. In Linked Accounts, make someone else the owner of each extra household, leave those households, and then delete the account.",
    );
    expect(db.users).toHaveLength(1);
    expect(db.groups).toHaveLength(2);
    expect(db.queries.some((query) => query === "BEGIN")).toBe(false);
  });

  it("promotes a co-owner ahead of an earlier member", async () => {
    const db = install(new AccountDeletionDb());
    db.users.push(
      user({ user_id: 1, email: "owner@example.com" }),
      user({ user_id: 2, email: "member@example.com" }),
      user({ user_id: 3, email: "co@example.com" }),
    );
    session(db, 1, "session-owner");
    db.groups.push({ group_id: 10, group_name: "Home", created_by: 1 });
    db.members.push(
      { group_id: 10, user_id: 1, role: "owner", created_at: "2024-01-01T00:00:00.000Z" },
      { group_id: 10, user_id: 2, role: "member", created_at: "2024-02-01T00:00:00.000Z" },
      { group_id: 10, user_id: 3, role: "owner", created_at: "2024-09-01T00:00:00.000Z" },
    );
    db.rows.budgets.push({ budget_id: 1, user_id: 1, group_id: 10, name: "Shared" });

    await call(db, { cookie: "session-owner", body: { confirmEmail: "owner@example.com", password: PASSWORD } });

    expect(db.groups[0]?.created_by).toBe(3);
    expect(db.members.find((item) => item.user_id === 3)?.role).toBe("owner");
    expect(db.members.find((item) => item.user_id === 2)?.role).toBe("member");
    expect(db.rows.budgets[0]).toMatchObject({ user_id: 3, group_id: 10 });
  });

  it("names the migration when the throttle table is missing", async () => {
    const db = install(new AccountDeletionDb());
    db.relations.delete("account_deletion_attempts");
    db.users.push(user({ user_id: 1, email: "a@example.com" }));
    session(db, 1, "session-a");
    await expectStatus(
      call(db, { cookie: "session-a", body: { confirmEmail: "a@example.com", password: PASSWORD } }).then((item) => item.value),
      500,
      "Account deletion is not ready. Run scripts/create_account_deletion_attempts.sql before deleting accounts.",
    );
    expect(db.users).toHaveLength(1);
  });

  it("retries pending deletes from the cleanup cron and rejects a missing secret", async () => {
    const db = install(new AccountDeletionDb());
    db.rows.pending_storage_deletes.push({
      storage_path: "solo/remove",
      storage_backend: "disk",
      deleted_at: null,
      attempt_count: 0,
    });
    db.rows.deleted_auth_users.push({
      supabase_user_id: "sb-old",
      app_user_id: 9,
      auth_deleted_at: null,
      attempt_count: 0,
    });
    db.rows.account_deletion_attempts.push({
      user_id: 9,
      ip_hash: "old",
      succeeded: false,
      attempted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
    process.env.CRON_SECRET = "1234567890123456";
    await expectStatus(
      (accountCleanup as (event: HandlerEvent) => Promise<unknown>)(makeEvent({
        method: "GET",
        url: "/api/cron/account-cleanup",
      })),
      401,
    );
    const result = await (accountCleanup as (event: HandlerEvent) => Promise<{ filesRemoved: number; authUsersRemoved: number; attemptsPurged: number }>)(makeEvent({
      method: "GET",
      url: "/api/cron/account-cleanup",
      headers: { authorization: "Bearer 1234567890123456" },
    }));
    expect(result.filesRemoved).toBe(1);
    expect(result.authUsersRemoved).toBe(1);
    expect(result.attemptsPurged).toBe(1);
    const logged = vi.mocked(console.error).mock.calls.map((args) => JSON.stringify(args)).join(" ");
    expect(logged).not.toContain("solo/remove");
    expect(logged).not.toContain("sb-old");
    expect(db.rows.pending_storage_deletes[0]?.deleted_at).toBeTruthy();
    expect(db.rows.deleted_auth_users[0]?.auth_deleted_at).toBeTruthy();
  });

  it("detaches a private asset for 90 days and the cron deletes only expired rows", async () => {
    const db = install(new AccountDeletionDb());
    db.users.push(user({ user_id: 1, email: "a@example.com" }));
    session(db, 1, "session-a");
    db.rows.asset_inventory.push({ ai_id: 7, user_id: 1, group_id: null, title: "ring" });
    db.rows.asset_vehicles.push({ vh_id: 8, user_id: 1, group_id: 10, title: "shared" });
    await call(db, { cookie: "session-a", body: { confirmEmail: "a@example.com", password: PASSWORD } });
    expect(db.rows.asset_inventory[0]?.user_id).toBeNull();
    expect(db.rows.asset_vehicles[0]?.user_id).toBe(1);
    expect(db.rows.deleted_user_private_rows).toHaveLength(1);
    expect(db.rows.deleted_user_private_rows[0]).toMatchObject({ table_name: "asset_inventory", row_pk: "7", former_user_id: 1 });
    expect(db.queries.some((query) => query.toLowerCase().includes("record_shares"))).toBe(false);

    db.rows.deleted_user_private_rows[0].purge_after = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    db.rows.asset_vehicles.push({ vh_id: 9, user_id: null, make: "keep" });
    db.rows.deleted_user_private_rows.push({
      id: 2,
      table_name: "asset_vehicles",
      row_pk: "9",
      former_user_id: 1,
      purge_after: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    process.env.CRON_SECRET = "1234567890123456";
    const result = await (accountCleanup as (event: HandlerEvent) => Promise<{ privateRowsPurged: number }>)(makeEvent({
      method: "GET",
      url: "/api/cron/account-cleanup",
      headers: { authorization: "Bearer 1234567890123456" },
    }));
    expect(result.privateRowsPurged).toBe(1);
    expect(db.rows.asset_inventory).toEqual([]);
    expect(db.rows.asset_vehicles.some((row) => row.vh_id === 9)).toBe(true);
    expect(db.rows.deleted_user_private_rows.map((row) => row.row_pk)).toEqual(["9"]);
    const logged = vi.mocked(console.error).mock.calls.map((args) => JSON.stringify(args)).join(" ");
    expect(logged).toContain("asset_inventory");
    expect(logged).not.toContain("ring");
    expect(logged).not.toContain("former_user_id");
  });

  it("keeps private holdings and service history with the parent for 90 days", async () => {
    const db = install(new AccountDeletionDb());
    db.users.push(user({ user_id: 1, email: "owner@example.com" }), user({ user_id: 2, email: "member@example.com" }));
    session(db, 2, "session-m");
    db.groups.push({ group_id: 4, group_name: "Home", created_by: 1 });
    db.members.push(
      { group_id: 4, user_id: 1, role: "owner", created_at: "2024-01-01" },
      { group_id: 4, user_id: 2, role: "member", created_at: "2024-02-01" },
    );
    db.rows.cash_and_investments.push(
      { ci_id: 10, user_id: 2, group_id: 4, institution: "shared-bank" },
      { ci_id: 11, user_id: 2, group_id: null, institution: "private-bank" },
    );
    db.rows.investment_positions.push(
      { position_id: 1, ci_id: 10, user_id: 2, group_id: 4, symbol: "AAA" },
      { position_id: 2, ci_id: 11, user_id: 2, group_id: null, symbol: "BBB" },
    );
    db.rows.asset_vehicles.push({ vh_id: 3, user_id: 2, group_id: null, make: "Bike" });
    db.rows.vehicle_service_records.push({ vsr_id: 5, vh_id: 3, user_id: 2, group_id: null, service_name: "oil" });
    await call(db, { cookie: "session-m", body: { confirmEmail: "member@example.com", password: PASSWORD } });
    expect(db.users.map((item) => item.user_id)).toEqual([1]);
    expect(db.rows.cash_and_investments.find((row) => row.ci_id === 10)?.user_id).toBe(1);
    expect(db.rows.investment_positions.find((row) => row.position_id === 1)?.user_id).toBe(1);
    expect(db.rows.cash_and_investments.find((row) => row.ci_id === 11)?.user_id).toBeNull();
    expect(db.rows.investment_positions.find((row) => row.position_id === 2)?.user_id).toBeNull();
    expect(db.rows.asset_vehicles[0]?.user_id).toBeNull();
    expect(db.rows.vehicle_service_records[0]?.user_id).toBeNull();
    expect(db.rows.deleted_user_private_rows.map((row) => row.table_name).sort()).toEqual(["asset_vehicles", "cash_and_investments"]);

    const cashHold = db.rows.deleted_user_private_rows.find((row) => row.table_name === "cash_and_investments");
    if (cashHold) cashHold.purge_after = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    process.env.CRON_SECRET = "1234567890123456";
    const result = await (accountCleanup as (event: HandlerEvent) => Promise<{ privateRowsPurged: number }>)(makeEvent({
      method: "GET",
      url: "/api/cron/account-cleanup",
      headers: { authorization: "Bearer 1234567890123456" },
    }));
    expect(result.privateRowsPurged).toBe(2);
    expect(db.rows.investment_positions.map((row) => row.position_id)).toEqual([1]);
    expect(db.rows.cash_and_investments.map((row) => row.ci_id)).toEqual([10]);
    expect(db.rows.vehicle_service_records).toHaveLength(1);
    expect(db.rows.asset_vehicles).toHaveLength(1);
    expect(db.queries.some((query) => query.includes("LIMIT") && query.includes("investment_positions"))).toBe(true);
    const logged = vi.mocked(console.error).mock.calls.map((args) => JSON.stringify(args)).join(" ");
    expect(logged).toContain("investment_positions");
    expect(logged).not.toContain("BBB");
    expect(logged).not.toContain("private-bank");
  });

  it("refuses to delete when holding a child still requires a user id", async () => {
    const db = install(new AccountDeletionDb());
    db.userIdNotNull.add("investment_positions");
    db.users.push(user({ user_id: 1, email: "a@example.com" }));
    session(db, 1, "session-a");
    db.rows.cash_and_investments.push({ ci_id: 4, user_id: 1, group_id: null });
    db.rows.investment_positions.push({ position_id: 8, ci_id: 4, user_id: 1, group_id: null, symbol: "BBB" });
    await expectStatus(
      call(db, { cookie: "session-a", body: { confirmEmail: "a@example.com", password: PASSWORD } }).then((item) => item.value),
      500,
      "Account deletion is not ready. Run scripts/alter_hold_child_user_id_nullable.sql before deleting accounts.",
    );
    expect(db.users).toHaveLength(1);
    expect(db.rows.investment_positions[0]?.user_id).toBe(1);
    expect(db.rows.cash_and_investments[0]?.user_id).toBe(1);
  });

  it("refuses to delete when the private-row queue is missing", async () => {
    const db = install(new AccountDeletionDb());
    db.relations.delete("deleted_user_private_rows");
    db.users.push(user({ user_id: 1, email: "a@example.com" }));
    session(db, 1, "session-a");
    await expectStatus(
      call(db, { cookie: "session-a", body: { confirmEmail: "a@example.com", password: PASSWORD } }).then((item) => item.value),
      500,
      "Account deletion is not ready. Run scripts/create_deleted_user_private_rows.sql before deleting accounts.",
    );
    expect(db.users).toHaveLength(1);
  });

  it("purges only this user's old throttle rows, and the daily job deletes a limited batch", async () => {
    const db = install(new AccountDeletionDb());
    db.users.push(user({ user_id: 1, email: "a@example.com" }));
    session(db, 1, "session-a");
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    db.rows.account_deletion_attempts.push(
      { user_id: 1, ip_hash: "old-a", succeeded: false, attempted_at: old },
      { user_id: 2, ip_hash: "old-b", succeeded: false, attempted_at: old },
    );
    await expectStatus(
      call(db, { cookie: "session-a", body: { confirmEmail: "a@example.com", password: "wrong" } }).then((item) => item.value),
      400,
    );
    expect(db.rows.account_deletion_attempts.some((row) => row.user_id === 1 && row.ip_hash === "old-a")).toBe(false);
    expect(db.rows.account_deletion_attempts.some((row) => row.user_id === 2 && row.ip_hash === "old-b")).toBe(true);

    for (let index = 0; index < 3; index += 1) {
      db.rows.account_deletion_attempts.push({
        user_id: 8,
        ip_hash: `batch-${index}`,
        succeeded: false,
        attempted_at: old,
      });
    }
    process.env.CRON_SECRET = "1234567890123456";
    const result = await (accountCleanup as (event: HandlerEvent) => Promise<{ attemptsPurged: number }>)(makeEvent({
      method: "GET",
      url: "/api/cron/account-cleanup",
      headers: { authorization: "Bearer 1234567890123456" },
    }));
    expect(result.attemptsPurged).toBe(4);
    expect(db.queries.some((query) => query.includes("LIMIT 500"))).toBe(true);
    expect(db.rows.account_deletion_attempts.every((row) => Date.parse(String(row.attempted_at)) > Date.now() - 24 * 60 * 60 * 1000)).toBe(true);
  });

  it("reads the Vercel client address and ignores a forwarded header elsewhere", async () => {
    const db = install(new AccountDeletionDb());
    db.users.push(user({ user_id: 1, email: "a@example.com" }));
    session(db, 1, "session-a");
    await expectStatus(
      call(db, {
        cookie: "session-a",
        body: { confirmEmail: "a@example.com", password: "wrong" },
        headers: {
          "x-vercel-forwarded-for": "203.0.113.5, 198.51.100.1",
          "x-forwarded-for": "198.51.100.9",
        },
      }).then((item) => item.value),
      400,
    );
    expect(db.rows.account_deletion_attempts.at(-1)?.ip_hash).toBe(deletionIpHash("203.0.113.5"));

    await expectStatus(
      call(db, {
        cookie: "session-a",
        body: { confirmEmail: "a@example.com", password: "wrong" },
        headers: { "x-forwarded-for": "198.51.100.9" },
      }).then((item) => item.value),
      400,
    );
    expect(db.rows.account_deletion_attempts.at(-1)?.ip_hash).toBe(deletionIpHash("unknown"));
  });
});
