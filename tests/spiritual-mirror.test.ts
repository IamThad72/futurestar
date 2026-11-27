import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mirrorGet from "../server/api/spiritual/mirror.get";
import { sundaySaturdayBounds } from "../utils/liturgicalCalendar.js";
import { weeklyMirror } from "../utils/spiritualMirror.js";
import { makeEvent } from "./helpers/event";

const GROQ_KEY = "gsk_test_mirror_must_not_send";

const REVIEWS = [
  {
    user_id: 1,
    review_on: "2026-11-22",
    virtue: "Patience",
    tomorrow: "Call home",
    troubled: "hurry at work",
    shortfall: "",
  },
  {
    user_id: 1,
    review_on: "2026-11-23",
    virtue: "Patience",
    tomorrow: "",
    troubled: "hurry again",
    shortfall: "hurry",
  },
  {
    user_id: 2,
    review_on: "2026-11-22",
    virtue: "Secret",
    tomorrow: "Keep this private",
    troubled: "hidden worry",
    shortfall: "hidden",
  },
];

const USERS: Record<string, { user_id: number; email: string; display_name: string; profile_photo: null }> = {
  "session-user-a": { user_id: 1, email: "a@example.com", display_name: "User A", profile_photo: null },
  "session-user-b": { user_id: 2, email: "b@example.com", display_name: "User B", profile_photo: null },
};

vi.mock("../server/utils/db", () => ({
  createDbClient: () => ({
    connect: async () => undefined,
    end: async () => undefined,
    query: async (sql: string, params: unknown[] = []) => {
      const text = sql.replace(/\s+/g, " ");
      if (text.includes("FROM app_sessions")) {
        const user = USERS[String(params[0] ?? "")];
        return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
      }
      if (text.includes("spiritual_daily_reviews")) {
        const userId = Number(params[0]);
        const start = String(params[1]);
        const end = String(params[2]);
        const rows = REVIEWS.filter(
          (row) => row.user_id === userId && row.review_on >= start && row.review_on <= end,
        );
        return { rows, rowCount: rows.length };
      }
      throw new Error(`Unexpected SQL in mirror test: ${text}`);
    },
  }),
}));

function callMirror(url: string, session?: string) {
  const headers: Record<string, string> = {};
  if (session) headers.cookie = `session=${session}`;
  return mirrorGet(makeEvent({ url, headers }));
}

let fetchCalls: unknown[][] = [];
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  fetchCalls = [];
  savedEnv.GROQ_API_KEY = process.env.GROQ_API_KEY;
  savedEnv.NUXT_GROQ_API_KEY = process.env.NUXT_GROQ_API_KEY;
  savedEnv.GROQ_MODEL = process.env.GROQ_MODEL;
  process.env.GROQ_API_KEY = GROQ_KEY;
  process.env.NUXT_GROQ_API_KEY = GROQ_KEY;
  process.env.GROQ_MODEL = "openai/gpt-oss-20b";
  vi.stubGlobal("fetch", vi.fn(async (...args: unknown[]) => {
    fetchCalls.push(args);
    return new Response(
      JSON.stringify({ choices: [{ message: { content: '{"text":"A model wrote this weekly mirror."}' } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(savedEnv)) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("weekly spiritual mirror", () => {
  it("returns the app-written note and never calls fetch when a Groq key is set", async () => {
    const bounds = sundaySaturdayBounds("2026-11-25");
    expect(bounds).toEqual({ start: "2026-11-22", end: "2026-11-28" });
    expect(process.env.GROQ_API_KEY).toBe(GROQ_KEY);
    expect(process.env.NUXT_GROQ_API_KEY).toBe(GROQ_KEY);

    const data = await callMirror("/api/spiritual/mirror?date=2026-11-25", "session-user-a") as {
      start: string;
      end: string;
      facts: { days: number; virtues: { name: string; count: number }[]; tomorrowFilled: number; words: { word: string }[] };
      text: string;
    };

    const expected = weeklyMirror(REVIEWS.filter((row) => row.user_id === 1));
    expect(fetchCalls).toEqual([]);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(Object.keys(data).sort()).toEqual(["end", "facts", "start", "text"]);
    expect(data.start).toBe("2026-11-22");
    expect(data.end).toBe("2026-11-28");
    expect(data.facts).toEqual(expected.facts);
    expect(data.text).toBe(expected.text);
    expect(data.text).toBe(
      "2 days have a review. virtues named: Patience 2 times. tomorrow was filled 1 time. repeated words include hurry.",
    );
    expect(data.text).not.toMatch(/model wrote/i);
  });

  it("returns the empty-week note without calling fetch", async () => {
    const data = await callMirror("/api/spiritual/mirror?date=2026-01-07", "session-user-a") as { text: string; facts: { days: number } };
    expect(data.facts.days).toBe(0);
    expect(data.text).toBe("No reviews are saved for this week yet.");
    expect(fetchCalls).toEqual([]);
  });

  it("does not include another person's reviews in the note", async () => {
    const data = await callMirror("/api/spiritual/mirror?date=2026-11-25", "session-user-b") as { text: string; facts: { days: number; virtues: { name: string }[] } };
    expect(data.facts.days).toBe(1);
    expect(data.facts.virtues.map((row) => row.name)).toEqual(["Secret"]);
    expect(data.text).not.toMatch(/Patience|hurry/);
    expect(fetchCalls).toEqual([]);
  });

  it("rejects an anonymous caller before any fetch", async () => {
    await expect(callMirror("/api/spiritual/mirror")).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: "You must be logged in.",
    });
    expect(fetchCalls).toEqual([]);
  });
});
