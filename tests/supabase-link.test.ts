import { beforeEach, describe, expect, it, vi } from "vitest";
import linkUser from "../server/api/auth/supabase-link.post";
import { makeEvent } from "./helpers/event";
import { AccountDeletionDb } from "./helpers/accountDeletionDb";

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
        const db = (globalThis as { __accountDeletionDb?: AccountDeletionDb }).__accountDeletionDb;
        const id = db?.supabaseIdForJwt(jwt);
        if (!id) return { data: { user: null }, error: { message: "invalid jwt" } };
        return { data: { user: { id, email: "new@example.com" } }, error: null };
      },
    },
  },
}));

vi.mock("../server/utils/supabaseAdmin", () => ({
  getSupabaseAdmin: () =>
    (globalThis as { __supabaseAdmin?: { auth: { admin: { deleteUser: (id: string, soft?: boolean) => Promise<{ error: null }> } } } }).__supabaseAdmin ?? null,
}));

function install() {
  const db = new AccountDeletionDb();
  (globalThis as { __accountDeletionDb?: AccountDeletionDb }).__accountDeletionDb = db;
  (globalThis as { __supabaseAdmin?: unknown }).__supabaseAdmin = {
    auth: { admin: { deleteUser: vi.fn(async () => ({ data: { user: null }, error: null })) } },
  };
  return db;
}

async function expectStatus(promise: Promise<unknown>, statusCode: number, statusMessage?: string) {
  try {
    const value = await promise;
    throw new Error(`expected HTTP ${statusCode} but resolved ${JSON.stringify(value)}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("expected HTTP")) throw error;
    expect(error).toMatchObject({ statusCode });
    if (statusMessage) expect((error as { statusMessage?: string }).statusMessage).toBe(statusMessage);
  }
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("supabase-link and deleted sign-ins", () => {
  it("creates an app user for a new sign-in", async () => {
    const db = install();
    db.trustJwt("jwt-new", "sb-new");
    const event = makeEvent({
      method: "POST",
      url: "/api/auth/supabase-link",
      headers: { authorization: "Bearer jwt-new" },
    });
    const created = await linkUser(event) as { user: { email: string } };
    expect(created.user.email).toBe("new@example.com");
    expect(db.users.map((user) => user.supabase_user_id)).toEqual(["sb-new"]);
  });

  it("refuses a deleted sign-in and retries auth removal", async () => {
    const db = install();
    db.trustJwt("jwt-old", "sb-old");
    db.rows.deleted_auth_users.push({
      supabase_user_id: "sb-old",
      app_user_id: 9,
      auth_deleted_at: null,
      attempt_count: 0,
    });
    const event = makeEvent({
      method: "POST",
      url: "/api/auth/supabase-link",
      headers: { authorization: "Bearer jwt-old" },
    });
    await expectStatus(
      linkUser(event),
      403,
      "This sign-in was deleted and cannot open an account.",
    );
    expect(db.users).toHaveLength(0);
    expect(db.rows.deleted_auth_users[0]?.auth_deleted_at).toBeTruthy();
    const admin = (globalThis as { __supabaseAdmin: { auth: { admin: { deleteUser: ReturnType<typeof vi.fn> } } } }).__supabaseAdmin;
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith("sb-old", false);
  });
});
