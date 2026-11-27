import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPassword = vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null }));
const signOut = vi.fn(async () => ({ error: null }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { signInWithPassword, signOut },
  }),
}));

describe("supabase password check", () => {
  beforeEach(() => {
    signInWithPassword.mockClear();
    signOut.mockClear();
    process.env.SUPABASE_URL = "https://placeholder.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "placeholder-publishable-key";
  });

  it("signs out only the local client so other sessions stay valid", async () => {
    const { supabasePasswordMatches } = await import("../server/utils/supabasePassword");
    const ok = await supabasePasswordMatches("ada@example.com", "secret");
    expect(ok).toBe(true);
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "ada@example.com", password: "secret" });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(signOut).not.toHaveBeenCalledWith();
  });
});