import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TAX_DEDUCTION_SETUP_MESSAGE, TAX_PROFILE_SETUP_MESSAGE } from "../server/utils/taxHouseholdProfile";
import { makeEvent } from "./helpers/event";
import deductionOverridesGet from "../server/api/tax/deduction-overrides.get";
import deductionOverridesPut from "../server/api/tax/deduction-overrides.put";
import householdProfileGet from "../server/api/tax/household-profile.get";
import householdProfilePut from "../server/api/tax/household-profile.put";

const SESSION = "session-user-a";

type QueryResult = { rows: Record<string, unknown>[]; rowCount: number };

function relationError(table: string) {
  const error = new Error(`relation "${table}" does not exist`) as Error & { code: string };
  error.code = "42P01";
  return error;
}

function taxTestQuery(sql: string, params: unknown[] = []): QueryResult {
  const text = sql.replace(/\s+/g, " ").trim();
  if (text.includes("FROM app_sessions")) {
    if (params[0] !== SESSION) return { rows: [], rowCount: 0 };
    return {
      rows: [{ user_id: 1, email: "a@example.com", display_name: "User A", profile_photo: null }],
      rowCount: 1,
    };
  }
  if (text.includes("FROM group_members")) return { rows: [], rowCount: 0 };
  if (text.includes("to_regclass")) return { rows: [{ rel: null }], rowCount: 1 };
  if (text.includes("tax_household_profiles")) throw relationError("tax_household_profiles");
  if (text.includes("tax_deduction_overrides")) throw relationError("tax_deduction_overrides");
  throw new Error(`Unhandled SQL in tax test db: ${text}`);
}

vi.mock("../server/utils/db", () => ({
  createDbClient: () => {
    const db = (globalThis as { __taxTestDb?: { query: (sql: string, params?: unknown[]) => QueryResult } }).__taxTestDb;
    if (!db) throw new Error("Tax test database is not initialized.");
    return {
      connect: async () => undefined,
      query: (sql: string, params?: unknown[]) => db.query(sql, params),
      end: async () => undefined,
    };
  },
}));

type Handler = (event: ReturnType<typeof makeEvent>) => Promise<unknown>;

function call(handler: Handler, options: { method?: string; url: string; body?: unknown; signedIn?: boolean }) {
  const headers: Record<string, string> = {};
  if (options.signedIn) headers.cookie = `session=${SESSION}`;
  return handler(makeEvent({
    method: options.method,
    url: options.url,
    headers,
    body: options.body,
  }));
}

async function expectStatus(promise: Promise<unknown>, statusCode: number, statusMessage: string) {
  try {
    const value = await promise;
    throw new Error(`expected HTTP ${statusCode} but the handler resolved: ${JSON.stringify(value)}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("expected HTTP")) throw error;
    expect(error).toMatchObject({ statusCode, statusMessage });
    const message = String((error as { message?: string }).message ?? "");
    expect(message).not.toMatch(/scripts\/|\.sql/);
    expect(statusMessage).not.toMatch(/scripts\/|\.sql|Supabase/);
  }
}

function loggedSetupHint() {
  return vi.mocked(console.error).mock.calls.map((entry) => String(entry[0]));
}

beforeEach(() => {
  (globalThis as { __taxTestDb?: { query: typeof taxTestQuery } }).__taxTestDb = { query: taxTestQuery };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("tax setup failures stay friendly in the response and specific in the log", () => {
  it("requires a session before it talks about storage", async () => {
    await expectStatus(call(householdProfileGet, { url: "/api/tax/household-profile?year=2026" }), 401, "You must be logged in.");
    await expectStatus(
      call(householdProfilePut, { method: "PUT", url: "/api/tax/household-profile", body: { filing_status: "single", state_code: "OH" } }),
      401,
      "You must be logged in.",
    );
    expect(loggedSetupHint().some((line) => /scripts\//.test(line))).toBe(false);
  });

  it("returns a friendly tax-profile response and logs the SQL path when the table is missing", async () => {
    const loaded = await call(householdProfileGet, { url: "/api/tax/household-profile?year=2026", signedIn: true }) as {
      unavailable: boolean;
      profile: unknown;
      reason: string;
    };
    expect(loaded.unavailable).toBe(true);
    expect(loaded.profile).toBeNull();
    expect(loaded.reason).toBe("missing_table");
    expect(JSON.stringify(loaded)).not.toMatch(/scripts\/|\.sql|Supabase/);

    await expectStatus(
      call(householdProfilePut, {
        method: "PUT",
        url: "/api/tax/household-profile",
        signedIn: true,
        body: { tax_year: 2026, filing_status: "single", state_code: "OH" },
      }),
      503,
      TAX_PROFILE_SETUP_MESSAGE,
    );

    const logs = loggedSetupHint();
    expect(logs.some((line) => /scripts\/create_tax_household_profiles\.sql/.test(line))).toBe(true);
    expect(logs.some((line) => /npm run migrate/.test(line))).toBe(true);
    expect(logs.some((line) => /does not drop any table/.test(line))).toBe(true);
    expect(logs.some((line) => line.includes(TAX_PROFILE_SETUP_MESSAGE))).toBe(false);
  });

  it("returns a friendly line-classification response and logs the same SQL path", async () => {
    const listed = await call(deductionOverridesGet, { url: "/api/tax/deduction-overrides", signedIn: true }) as {
      unavailable: boolean;
      overrides: unknown[];
    };
    expect(listed.unavailable).toBe(true);
    expect(listed.overrides).toEqual([]);
    expect(JSON.stringify(listed)).not.toMatch(/scripts\/|\.sql|Supabase/);

    await expectStatus(
      call(deductionOverridesPut, {
        method: "PUT",
        url: "/api/tax/deduction-overrides",
        signedIn: true,
        body: { category: "Retirement", sub_category: "401k" },
      }),
      503,
      TAX_DEDUCTION_SETUP_MESSAGE,
    );

    const logs = loggedSetupHint();
    expect(logs.some((line) => /scripts\/create_tax_household_profiles\.sql/.test(line))).toBe(true);
    expect(logs.every((line) => !line.includes(TAX_DEDUCTION_SETUP_MESSAGE))).toBe(true);
  });

  it("shows the friendly sentence on the tax page and keeps the SQL path out of that screen", () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../pages/tax/[year].vue"), "utf8");
    expect(source).toContain(TAX_PROFILE_SETUP_MESSAGE);
    expect(source).not.toMatch(/create_tax_household_profiles\.sql|scripts\//);
  });
});
