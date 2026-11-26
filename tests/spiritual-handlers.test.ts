import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAITH_PROFILE_SETUP_MESSAGE } from "../server/utils/faithProfile";
import { CLIENT_DATE_WINDOW_DAYS, PRACTICES_SETUP_MESSAGE } from "../server/utils/faithPractices";
import { weekStartFor } from "../utils/worshipCheckin.js";
import { makeEvent } from "./helpers/event";
import { faithTestDb, installFaithTestDb, MemoryDb, TEST_USERS } from "./helpers/memoryDb";
import prayersDelete from "../server/api/spiritual/prayers/[id].delete";
import prayersPut from "../server/api/spiritual/prayers/[id].put";
import prayersGet from "../server/api/spiritual/prayers/index.get";
import prayersPost from "../server/api/spiritual/prayers/index.post";
import planDayGet from "../server/api/spiritual/plans/[id]/day.get";
import planDayPut from "../server/api/spiritual/plans/[id]/days/[day].put";
import planGet from "../server/api/spiritual/plans/[id].get";
import planPut from "../server/api/spiritual/plans/[id].put";
import plansGet from "../server/api/spiritual/plans/index.get";
import plansPost from "../server/api/spiritual/plans/index.post";
import profileGet from "../server/api/spiritual/profile.get";
import profilePut from "../server/api/spiritual/profile.put";
import worshipGet from "../server/api/spiritual/worship.get";
import worshipPut from "../server/api/spiritual/worship.put";

vi.mock("../server/utils/db", () => ({
  createDbClient: () => {
    const db = (globalThis as { __faithTestDb?: { client: () => unknown } }).__faithTestDb;
    if (!db) throw new Error("Faith test database is not initialized.");
    return db.client();
  },
}));

vi.mock("../server/utils/superbase", () => ({
  supabase: {
    auth: {
      getUser: async (jwt: string) => {
        const db = (globalThis as { __faithTestDb?: { supabaseIdForJwt: (token: string) => string | null } }).__faithTestDb;
        const id = db?.supabaseIdForJwt(jwt);
        if (!id) return { data: { user: null }, error: { message: "invalid jwt" } };
        return { data: { user: { id } }, error: null };
      },
    },
  },
}));

type Handler = (event: ReturnType<typeof makeEvent>) => Promise<unknown>;

type CallOptions = {
  method?: string;
  url: string;
  user?: keyof typeof TEST_USERS;
  jwt?: string;
  cookie?: string;
  body?: unknown;
  params?: Record<string, string>;
};

const routes: { name: string; handler: Handler; call: CallOptions }[] = [
  { name: "GET /api/spiritual/prayers", handler: prayersGet, call: { url: "/api/spiritual/prayers" } },
  { name: "POST /api/spiritual/prayers", handler: prayersPost, call: { method: "POST", url: "/api/spiritual/prayers", body: { title: "Healing" } } },
  { name: "PUT /api/spiritual/prayers/:id", handler: prayersPut, call: { method: "PUT", url: "/api/spiritual/prayers/1", params: { id: "1" }, body: { title: "Healing" } } },
  { name: "DELETE /api/spiritual/prayers/:id", handler: prayersDelete, call: { method: "DELETE", url: "/api/spiritual/prayers/1", params: { id: "1" } } },
  { name: "GET /api/spiritual/plans", handler: plansGet, call: { url: "/api/spiritual/plans" } },
  { name: "POST /api/spiritual/plans", handler: plansPost, call: { method: "POST", url: "/api/spiritual/plans", body: { plan_key: "gospels-30" } } },
  { name: "GET /api/spiritual/plans/:id", handler: planGet, call: { url: "/api/spiritual/plans/1", params: { id: "1" } } },
  { name: "PUT /api/spiritual/plans/:id", handler: planPut, call: { method: "PUT", url: "/api/spiritual/plans/1", params: { id: "1" }, body: { action: "stop" } } },
  { name: "GET /api/spiritual/plans/:id/day", handler: planDayGet, call: { url: "/api/spiritual/plans/1/day?day=1", params: { id: "1" } } },
  { name: "PUT /api/spiritual/plans/:id/days/:day", handler: planDayPut, call: { method: "PUT", url: "/api/spiritual/plans/1/days/1", params: { id: "1", day: "1" }, body: { status: "done" } } },
  { name: "GET /api/spiritual/profile", handler: profileGet, call: { url: "/api/spiritual/profile" } },
  { name: "PUT /api/spiritual/profile", handler: profilePut, call: { method: "PUT", url: "/api/spiritual/profile", body: { tradition: "catholic" } } },
  { name: "GET /api/spiritual/worship", handler: worshipGet, call: { url: "/api/spiritual/worship" } },
  { name: "PUT /api/spiritual/worship", handler: worshipPut, call: { method: "PUT", url: "/api/spiritual/worship", body: { attendance: "in_person" } } },
];

function localIso(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftIso(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

function call(handler: Handler, options: CallOptions) {
  const headers: Record<string, string> = {};
  if (options.user) headers.cookie = `session=${TEST_USERS[options.user].session_token}`;
  if (options.cookie) headers.cookie = options.cookie;
  if (options.jwt) headers.authorization = `Bearer ${options.jwt}`;
  return handler(makeEvent({
    method: options.method,
    url: options.url,
    headers,
    body: options.body,
    params: options.params,
  }));
}

async function expectStatus(promise: Promise<unknown>, statusCode: number, statusMessage?: RegExp | string) {
  try {
    const value = await promise;
    throw new Error(`expected HTTP ${statusCode} but the handler resolved: ${JSON.stringify(value)}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("expected HTTP")) throw error;
    expect(error).toMatchObject({ statusCode });
    if (statusMessage) {
      const message = String((error as { statusMessage?: string }).statusMessage ?? "");
      if (statusMessage instanceof RegExp) expect(message).toMatch(statusMessage);
      else expect(message).toBe(statusMessage);
    }
  }
}

beforeEach(() => {
  const db = new MemoryDb();
  db.seedUsers();
  installFaithTestDb(db);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("spiritual handlers reject anonymous callers", () => {
  it.each(routes)("$name returns 401 without a session", async ({ handler, call: options }) => {
    await expectStatus(call(handler, options), 401, "You must be logged in.");
    expect(faithTestDb().prayers).toHaveLength(0);
    expect(faithTestDb().plans).toHaveLength(0);
    expect(faithTestDb().profiles).toHaveLength(0);
    expect(faithTestDb().checkins).toHaveLength(0);
  });

  it("rejects an unknown session cookie and an unknown Supabase token", async () => {
    await expectStatus(call(prayersGet, { url: "/api/spiritual/prayers", cookie: "session=not-a-session" }), 401);
    await expectStatus(call(profileGet, { url: "/api/spiritual/profile", jwt: "not-a-jwt" }), 401);
  });

  it("accepts a Supabase bearer token mapped to the app user", async () => {
    const created = await call(prayersPost, {
      method: "POST",
      url: "/api/spiritual/prayers",
      jwt: TEST_USERS.a.jwt,
      body: { title: "For the neighbors" },
    }) as { prayer: { title: string } };
    expect(created.prayer.title).toBe("For the neighbors");
    expect(faithTestDb().prayers[0]?.user_id).toBe(TEST_USERS.a.user_id);

    const listed = await call(prayersGet, { url: "/api/spiritual/prayers", jwt: TEST_USERS.b.jwt }) as { prayers: unknown[] };
    expect(listed.prayers).toEqual([]);
  });
});

describe("spiritual handlers keep one user's rows away from another", () => {
  it("does not let user B read, edit, or delete user A's prayers", async () => {
    const created = await call(prayersPost, {
      method: "POST",
      url: "/api/spiritual/prayers",
      user: "a",
      body: { title: "A only", notes: "private", user_id: TEST_USERS.b.user_id, group_id: 9 },
    }) as { prayer: { prayer_id: number } };
    expect(faithTestDb().prayers).toEqual([
      expect.objectContaining({ prayer_id: created.prayer.prayer_id, user_id: TEST_USERS.a.user_id, title: "A only" }),
    ]);

    const listed = await call(prayersGet, { url: "/api/spiritual/prayers", user: "b" }) as { prayers: unknown[]; counts: { active: number } };
    expect(listed.prayers).toEqual([]);
    expect(listed.counts.active).toBe(0);

    const id = String(created.prayer.prayer_id);
    await expectStatus(call(prayersPut, { method: "PUT", url: `/api/spiritual/prayers/${id}`, user: "b", params: { id }, body: { title: "stolen" } }), 404, "Prayer request not found.");
    await expectStatus(call(prayersDelete, { method: "DELETE", url: `/api/spiritual/prayers/${id}`, user: "b", params: { id } }), 404, "Prayer request not found.");

    const still = await call(prayersGet, { url: "/api/spiritual/prayers", user: "a" }) as { prayers: { title: string }[] };
    expect(still.prayers.map((prayer) => prayer.title)).toEqual(["A only"]);
  });

  it("does not let user B read or change user A's reading plan, and both may start the same plan", async () => {
    const today = localIso();
    const started = await call(plansPost, {
      method: "POST",
      url: "/api/spiritual/plans",
      user: "a",
      body: { plan_key: "gospels-30", start_on: today },
    }) as { plan: { user_plan_id: number; status: string } };
    const id = String(started.plan.user_plan_id);

    await expectStatus(call(planGet, { url: `/api/spiritual/plans/${id}`, user: "b", params: { id } }), 404, "Reading plan not found.");
    await expectStatus(call(planPut, { method: "PUT", url: `/api/spiritual/plans/${id}`, user: "b", params: { id }, body: { action: "stop" } }), 404);
    await expectStatus(call(planDayGet, { url: `/api/spiritual/plans/${id}/day?day=1`, user: "b", params: { id } }), 404);
    await expectStatus(
      call(planDayPut, { method: "PUT", url: `/api/spiritual/plans/${id}/days/1`, user: "b", params: { id, day: "1" }, body: { status: "done" } }),
      404,
    );

    const owned = await call(planGet, { url: `/api/spiritual/plans/${id}`, user: "a", params: { id } }) as { plan: { status: string } };
    expect(owned.plan.status).toBe("active");
    expect(faithTestDb().progress).toHaveLength(0);

    const other = await call(plansPost, {
      method: "POST",
      url: "/api/spiritual/plans",
      user: "b",
      body: { plan_key: "gospels-30", start_on: today },
    }) as { plan: { user_plan_id: number } };
    expect(other.plan.user_plan_id).not.toBe(started.plan.user_plan_id);
    expect(faithTestDb().plans.map((row) => row.user_id).sort()).toEqual([TEST_USERS.a.user_id, TEST_USERS.b.user_id]);
  });

  it("does not let user B read user A's faith profile or worship check-in", async () => {
    await call(profilePut, {
      method: "PUT",
      url: "/api/spiritual/profile",
      user: "a",
      body: { tradition: "orthodox", translation: "WEB", show_calendar: false, user_id: TEST_USERS.b.user_id },
    });
    const intruder = await call(profileGet, { url: "/api/spiritual/profile", user: "b" }) as {
      exists: boolean;
      profile: { tradition: string; show_calendar: boolean };
    };
    expect(intruder.exists).toBe(false);
    expect(intruder.profile.tradition).toBe("christian");
    expect(intruder.profile.show_calendar).toBe(true);

    const owner = await call(profileGet, { url: "/api/spiritual/profile", user: "a" }) as { profile: { tradition: string; show_calendar: boolean } };
    expect(owner.profile).toMatchObject({ tradition: "orthodox", show_calendar: false });

    const today = localIso();
    await call(worshipPut, {
      method: "PUT",
      url: "/api/spiritual/worship",
      user: "a",
      body: { attendance: "in_person", church_name: "St. A's", date: today, user_id: TEST_USERS.b.user_id },
    });
    const worship = await call(worshipGet, { url: `/api/spiritual/worship?date=${today}`, user: "b" }) as {
      current: unknown;
      history: unknown[];
      last_church: string;
    };
    expect(worship.current).toBeNull();
    expect(worship.history).toEqual([]);
    expect(worship.last_church).toBe("");
    expect(faithTestDb().checkins.map((row) => row.user_id)).toEqual([TEST_USERS.a.user_id]);
  });
});

describe("spiritual handlers validate input, including the client date", () => {
  const today = localIso();
  const within = shiftIso(today, 1);
  const edge = shiftIso(today, CLIENT_DATE_WINDOW_DAYS);
  const outside = shiftIso(today, CLIENT_DATE_WINDOW_DAYS + 1);

  it("uses a real client date inside the window and ignores impossible or distant dates", async () => {
    const rolled = await call(prayersPost, {
      method: "POST",
      url: `/api/spiritual/prayers?date=${edge}`,
      user: "a",
      body: { title: "Rolled", date: "2026-02-31" },
    }) as { prayer: { created_on: string } };
    expect(rolled.prayer.created_on).toBe(today);
    expect(rolled.prayer.created_on).not.toBe("2026-03-03");

    const shifted = await call(prayersPost, {
      method: "POST",
      url: "/api/spiritual/prayers",
      user: "a",
      body: { title: "Near", date: within },
    }) as { prayer: { created_on: string; prayer_id: number } };
    expect(shifted.prayer.created_on).toBe(within);

    const distant = await call(prayersPost, {
      method: "POST",
      url: "/api/spiritual/prayers",
      user: "a",
      body: { title: "Far", date: outside },
    }) as { prayer: { created_on: string } };
    expect(distant.prayer.created_on).toBe(today);

    const answered = await call(prayersPut, {
      method: "PUT",
      url: `/api/spiritual/prayers/${shifted.prayer.prayer_id}`,
      user: "a",
      params: { id: String(shifted.prayer.prayer_id) },
      body: { action: "answer", date: "2026-04-31" },
    }) as { prayer: { answered_on: string } };
    expect(answered.prayer.answered_on).toBe(today);

    const plans = await call(plansGet, { url: `/api/spiritual/plans?date=${edge}`, user: "a" }) as { today: string };
    expect(plans.today).toBe(edge);
    const impossible = await call(plansGet, { url: "/api/spiritual/plans?date=2026-02-31", user: "a" }) as { today: string };
    expect(impossible.today).toBe(today);
    const tooFar = await call(plansGet, { url: `/api/spiritual/plans?date=${outside}`, user: "a" }) as { today: string };
    expect(tooFar.today).toBe(today);
  });

  it("keeps worship weeks and plan progress on the trusted date", async () => {
    const saved = await call(worshipPut, {
      method: "PUT",
      url: "/api/spiritual/worship",
      user: "a",
      body: { attendance: "in_person", church_name: "Grace", date: within },
    }) as { week_start: string; current: { church_name: string } };
    expect(saved.week_start).toBe(weekStartFor(within));
    expect(saved.current.church_name).toBe("Grace");

    const far = shiftIso(today, 40);
    const ignored = await call(worshipPut, {
      method: "PUT",
      url: "/api/spiritual/worship",
      user: "a",
      body: { attendance: "online", church_name: "Far Church", date: far },
    }) as { week_start: string; current: { church_name: string } | null };
    expect(ignored.week_start).toBe(weekStartFor(today));
    expect(ignored.current?.church_name).toBe("Far Church");
    expect(faithTestDb().checkins.some((row) => row.week_start === weekStartFor(far))).toBe(false);

    const started = await call(plansPost, {
      method: "POST",
      url: "/api/spiritual/plans",
      user: "a",
      body: { plan_key: "gospels-30", start_on: today, date: "2026-02-31" },
    }) as { plan: { user_plan_id: number; start_on: string } };
    expect(started.plan.start_on).toBe(today);

    await call(planDayPut, {
      method: "PUT",
      url: `/api/spiritual/plans/${started.plan.user_plan_id}/days/1`,
      user: "a",
      params: { id: String(started.plan.user_plan_id), day: "1" },
      body: { status: "done", date: outside },
    });
    expect(faithTestDb().progress).toEqual([
      expect.objectContaining({
        user_id: TEST_USERS.a.user_id,
        user_plan_id: started.plan.user_plan_id,
        day_number: 1,
        status: "done",
        marked_on: today,
      }),
    ]);

    await expectStatus(
      call(plansPost, {
        method: "POST",
        url: "/api/spiritual/plans",
        user: "b",
        body: { plan_key: "gospels-30", start_on: "2020-01-01", date: "2020-01-01" },
      }),
      400,
      "Choose a start date within about a year of today.",
    );
  });

  it("rejects malformed prayers, plans, worship, and profiles", async () => {
    await expectStatus(call(prayersPost, { method: "POST", url: "/api/spiritual/prayers", user: "a", body: { title: "  " } }), 400, "Give the request a short title.");
    await expectStatus(call(prayersPost, { method: "POST", url: "/api/spiritual/prayers", user: "a", body: { title: "Ok", category: "Sports" } }), 400, /category/);
    await expectStatus(
      call(prayersPut, { method: "PUT", url: "/api/spiritual/prayers/1", user: "a", params: { id: "1" }, body: { action: "answer", answered_on: "2026-02-31" } }),
      400,
      /YYYY-MM-DD/,
    );
    for (const id of ["0", "-3", "abc"]) {
      await expectStatus(call(prayersDelete, { method: "DELETE", url: `/api/spiritual/prayers/${id}`, user: "a", params: { id } }), 400, "Invalid prayer request.");
    }

    await expectStatus(call(plansPost, { method: "POST", url: "/api/spiritual/plans", user: "a", body: { plan_key: "not-a-plan" } }), 400, "Choose a reading plan from the list.");
    await expectStatus(call(plansPost, { method: "POST", url: "/api/spiritual/plans", user: "a", body: { plan_key: "deuterocanon-30" } }), 400, "Choose a reading plan from the list.");
    await expectStatus(
      call(plansPost, { method: "POST", url: "/api/spiritual/plans", user: "a", body: { plan_key: "gospels-30", start_on: "2026-02-31" } }),
      400,
      "Choose a start date.",
    );

    const started = await call(plansPost, {
      method: "POST",
      url: "/api/spiritual/plans",
      user: "a",
      body: { plan_key: "gospels-30", start_on: today },
    }) as { plan: { user_plan_id: number } };
    const id = String(started.plan.user_plan_id);
    await expectStatus(call(planPut, { method: "PUT", url: `/api/spiritual/plans/${id}`, user: "a", params: { id }, body: { action: "fly" } }), 400, "Unknown action.");
    await expectStatus(
      call(planDayPut, { method: "PUT", url: `/api/spiritual/plans/${id}/days/1`, user: "a", params: { id, day: "1" }, body: { status: "maybe" } }),
      400,
      "Status must be done, skipped or clear.",
    );
    await expectStatus(
      call(planDayPut, { method: "PUT", url: `/api/spiritual/plans/${id}/days/99`, user: "a", params: { id, day: "99" }, body: { status: "done" } }),
      400,
      /Day must be between 1 and 30/,
    );
    await expectStatus(call(planDayGet, { url: `/api/spiritual/plans/${id}/day?day=0`, user: "a", params: { id } }), 400, "Invalid day.");
    await expectStatus(call(plansPost, {
      method: "POST",
      url: "/api/spiritual/plans",
      user: "a",
      body: { plan_key: "gospels-30", start_on: shiftIso(today, 1) },
    }), 409, /already reading/);

    const day = await call(planDayGet, { url: `/api/spiritual/plans/${id}/day?day=1`, user: "a", params: { id } }) as { readings: { citation: string; verses: unknown[] }[]; catalog: { seeded: boolean } };
    expect(day.catalog.seeded).toBe(false);
    expect(day.readings.length).toBeGreaterThan(0);
    expect(day.readings[0]?.citation).toBeTruthy();
    expect(day.readings[0]?.verses).toEqual([]);

    await expectStatus(call(worshipPut, { method: "PUT", url: "/api/spiritual/worship", user: "a", body: { attendance: "maybe" } }), 400, /in person, online/);
    await expectStatus(
      call(worshipPut, { method: "PUT", url: "/api/spiritual/worship", user: "a", body: { attendance: "in_person", week_start: "2026-02-31" } }),
      400,
      "week_start must be the Sunday that starts the week.",
    );
    await expectStatus(
      call(worshipPut, { method: "PUT", url: "/api/spiritual/worship", user: "a", body: { attendance: "in_person", week_start: "2026-11-23" } }),
      400,
      "week_start must be the Sunday that starts the week.",
    );

    await expectStatus(call(profilePut, { method: "PUT", url: "/api/spiritual/profile", user: "a", body: { tradition: "pagan" } }), 400, /Christian, Protestant, Catholic or Orthodox/);
  });
});

describe("setup failures stay friendly in the response and specific in the log", () => {
  it("hides the practices SQL path from prayer, plan, and worship responses", async () => {
    faithTestDb().missing.add("prayer_requests");
    faithTestDb().missing.add("user_reading_plans");
    faithTestDb().missing.add("worship_checkins");

    const prayers = await call(prayersGet, { url: "/api/spiritual/prayers", user: "a" }) as { unavailable: boolean; message: string };
    expect(prayers.unavailable).toBe(true);
    expect(prayers.message).toBe(PRACTICES_SETUP_MESSAGE);
    expect(prayers.message).not.toMatch(/scripts\/|\.sql|Supabase/);

    const plans = await call(plansGet, { url: "/api/spiritual/plans", user: "a" }) as { unavailable: boolean; message: string };
    expect(plans.message).toBe(PRACTICES_SETUP_MESSAGE);
    expect(plans.message).not.toMatch(/scripts\/|\.sql/);

    const worship = await call(worshipGet, { url: "/api/spiritual/worship", user: "a" }) as { unavailable: boolean; message: string };
    expect(worship.message).toBe(PRACTICES_SETUP_MESSAGE);

    await expectStatus(
      call(prayersPost, { method: "POST", url: "/api/spiritual/prayers", user: "a", body: { title: "Healing" } }),
      503,
      PRACTICES_SETUP_MESSAGE,
    );
    expect(String(vi.mocked(console.error).mock.calls.at(-1)?.[0])).toMatch(/scripts\/create_faith_common\.sql/);
    expect(String(vi.mocked(console.error).mock.calls.at(-1)?.[0])).toMatch(/npm run migrate/);
  });

  it("hides the faith-profile SQL path and keeps the Catholic fallback", async () => {
    faithTestDb().missing.add("user_faith_profiles");
    const loaded = await call(profileGet, { url: "/api/spiritual/profile", user: "a" }) as {
      unavailable: boolean;
      exists: boolean;
      profile: { tradition: string; translation: string };
    };
    expect(loaded.unavailable).toBe(true);
    expect(loaded.exists).toBe(false);
    expect(loaded.profile).toMatchObject({ tradition: "catholic", translation: "CPDV" });
    expect(JSON.stringify(loaded)).not.toMatch(/scripts\/|\.sql/);

    await expectStatus(
      call(profilePut, { method: "PUT", url: "/api/spiritual/profile", user: "a", body: { tradition: "protestant" } }),
      503,
      FAITH_PROFILE_SETUP_MESSAGE,
    );
    const logs = vi.mocked(console.error).mock.calls.map((entry) => String(entry[0]));
    expect(logs.some((line) => /scripts\/create_faith_profiles\.sql/.test(line))).toBe(true);
    expect(logs.some((line) => /create_faith_common\.sql/.test(line))).toBe(false);
  });

  it("does not put the migration script in the faith settings screen", () => {
    const source = readFileSync(new URL("../components/FaithSettings.vue", import.meta.url), "utf8");
    const template = source.slice(0, source.indexOf("<script"));
    expect(template).toContain("Faith settings are not set up yet");
    expect(template).not.toMatch(/create_faith_profiles\.sql|scripts\//);
  });
});
