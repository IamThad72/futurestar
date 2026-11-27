import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROFILE_PHOTO_MAX_LENGTH } from "../utils/profilePhoto.js";
import updateProfile from "../server/api/auth/update-profile.post";
import { makeEvent } from "./helpers/event";

type StoredUser = {
  user_id: number;
  email: string;
  display_name: string | null;
  profile_photo: string | null;
  session_token: string;
};

const state = vi.hoisted(() => ({
  user: null as StoredUser | null,
  updates: [] as Array<string | null>,
}));

vi.mock("../server/utils/db", () => ({
  createDbClient: () => ({
    connect: async () => undefined,
    end: async () => undefined,
    query: async (sql: string, params: unknown[] = []) => {
      const text = sql.replace(/\s+/g, " ").trim();
      if (text.includes("FROM app_sessions")) {
        const token = String(params[0] ?? "");
        const user = state.user && state.user.session_token === token ? state.user : null;
        return {
          rows: user
            ? [{
                user_id: user.user_id,
                email: user.email,
                display_name: user.display_name,
                profile_photo: user.profile_photo,
              }]
            : [],
          rowCount: user ? 1 : 0,
        };
      }
      if (/^UPDATE app_users SET profile_photo/i.test(text)) {
        if (!state.user || Number(params[1]) !== state.user.user_id) return { rows: [], rowCount: 0 };
        const photo = params[0] == null ? null : String(params[0]);
        state.user.profile_photo = photo;
        state.updates.push(photo);
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unhandled SQL in profile photo test: ${text}`);
    },
  }),
}));

function photo(type = "png", payload = btoa("ok")) {
  return `data:image/${type};base64,${payload}`;
}

function call(body: unknown, cookie = "session=session-user-a") {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return updateProfile(makeEvent({
    method: "POST",
    url: "/api/auth/update-profile",
    headers,
    body,
  }));
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

beforeEach(() => {
  state.updates = [];
  state.user = {
    user_id: 1,
    email: "a@example.com",
    display_name: "User A",
    profile_photo: "keep-me",
    session_token: "session-user-a",
  };
});

describe("POST /api/auth/update-profile", () => {
  it("returns 401 when nobody is signed in and does not write", async () => {
    await expectStatus(call({ profilePhoto: photo() }, ""), 401, "You must be logged in.");
    expect(state.updates).toEqual([]);
    expect(state.user?.profile_photo).toBe("keep-me");
  });

  it("stores png, jpeg, jpg, gif, and webp data URLs", async () => {
    for (const type of ["png", "jpeg", "jpg", "gif", "webp"]) {
      const value = photo(type);
      await expect(call({ profilePhoto: `  ${value}  ` })).resolves.toEqual({ success: true });
      expect(state.user?.profile_photo).toBe(value);
    }
  });

  it("clears the photo for an empty value", async () => {
    state.user!.profile_photo = photo();
    await expect(call({ profilePhoto: "" })).resolves.toEqual({ success: true });
    expect(state.user?.profile_photo).toBeNull();
    state.user!.profile_photo = photo();
    await expect(call({ profilePhoto: "   " })).resolves.toEqual({ success: true });
    expect(state.user?.profile_photo).toBeNull();
    state.user!.profile_photo = photo();
    await expect(call({ profilePhoto: null })).resolves.toEqual({ success: true });
    expect(state.user?.profile_photo).toBeNull();
  });

  it.each([
    ["javascript:", "javascript:alert(1)"],
    ["http", "http://example.com/a.png"],
    ["https", "https://example.com/a.png"],
    ["svg", `data:image/svg+xml;base64,${btoa("<svg onload='alert(1)'></svg>")}`],
    ["malformed base64", "data:image/png;base64,abc"],
    ["non-canonical base64", "data:image/png;base64,aa=="],
    ["bad alphabet", "data:image/png;base64,@@@@"],
  ])("rejects %s with 400 and does not store it", async (_label, value) => {
    await expectStatus(call({ profilePhoto: value }), 400, "Choose a PNG, JPEG, GIF, or WebP photo.");
    expect(state.updates).toEqual([]);
    expect(state.user?.profile_photo).toBe("keep-me");
  });

  it("rejects an oversize photo with 400 and does not store it", async () => {
    const value = `data:image/png;base64,${"A".repeat(PROFILE_PHOTO_MAX_LENGTH)}`;
    expect(value.length).toBeGreaterThan(PROFILE_PHOTO_MAX_LENGTH);
    await expectStatus(
      call({ profilePhoto: value }),
      400,
      "That photo is too large to save. Choose a smaller picture.",
    );
    expect(state.updates).toEqual([]);
    expect(state.user?.profile_photo).toBe("keep-me");
  });
});
