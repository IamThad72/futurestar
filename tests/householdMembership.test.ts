import { describe, expect, it, vi } from "vitest";
import addMember from "../server/api/groups/add-member.post";
import createGroup from "../server/api/groups/create.post";
import transferOwnership from "../server/api/groups/transfer-ownership.post";
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
  supabase: { auth: { getUser: async () => ({ data: { user: null }, error: { message: "no" } }) } },
}));

vi.mock("../server/utils/group", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/utils/group")>();
  return { ...actual, backfillGroupIdForUser: async () => undefined };
});

function install() {
  const db = new AccountDeletionDb();
  db.users.push(
    {
      user_id: 1,
      email: "owner@example.com",
      display_name: null,
      profile_photo: null,
      password_hash: null,
      supabase_user_id: null,
    },
    {
      user_id: 2,
      email: "second@example.com",
      display_name: null,
      profile_photo: null,
      password_hash: null,
      supabase_user_id: null,
    },
  );
  db.sessions.push({
    session_token: "session-owner",
    user_id: 1,
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  });
  (globalThis as { __accountDeletionDb?: AccountDeletionDb }).__accountDeletionDb = db;
  return db;
}

function event(body: unknown) {
  return makeEvent({
    method: "POST",
    url: "/api/groups",
    headers: { cookie: "session=session-owner" },
    body,
  });
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

describe("one household per person", () => {
  it("does not add someone who is already in another household", async () => {
    const db = install();
    db.groups.push({ group_id: 10, group_name: "Home", created_by: 1 });
    db.groups.push({ group_id: 11, group_name: "Other", created_by: 8 });
    db.members.push(
      { group_id: 10, user_id: 1, role: "owner", created_at: "2024-01-01T00:00:00.000Z" },
      { group_id: 11, user_id: 2, role: "member", created_at: "2024-01-01T00:00:00.000Z" },
    );
    await expectStatus(
      addMember(event({ member_email: "second@example.com" })),
      409,
      "That person is already in a household.",
    );
    expect(db.members.filter((member) => member.user_id === 2)).toHaveLength(1);
  });

  it("does not start a household with someone who is already in one", async () => {
    const db = install();
    db.groups.push({ group_id: 11, group_name: "Other", created_by: 8 });
    db.members.push({ group_id: 11, user_id: 2, role: "member", created_at: "2024-01-01T00:00:00.000Z" });
    await expectStatus(
      createGroup(event({ group_name: "New", second_user_email: "second@example.com" })),
      409,
      "That person is already in a household.",
    );
    expect(db.groups.map((group) => group.group_name)).toEqual(["Other"]);
  });

  it("lets an owner hand the household to another member and then leave", async () => {
    const db = install();
    db.groups.push({ group_id: 10, group_name: "Home", created_by: 1 });
    db.members.push(
      { group_id: 10, user_id: 1, role: "owner", created_at: "2024-01-01T00:00:00.000Z" },
      { group_id: 10, user_id: 2, role: "member", created_at: "2024-02-01T00:00:00.000Z" },
    );
    const transferred = await transferOwnership(event({ user_id: 2 })) as { success: boolean };
    expect(transferred.success).toBe(true);
    expect(db.groups[0]?.created_by).toBe(2);
    expect(db.members.find((member) => member.user_id === 2)?.role).toBe("owner");
    expect(db.members.find((member) => member.user_id === 1)?.role).toBe("member");

    const left = await (await import("../server/api/groups/remove-member.post")).default(event({ user_id: 1 })) as { success: boolean };
    expect(left.success).toBe(true);
    expect(db.members.map((member) => member.user_id)).toEqual([2]);
  });
});
