/**
 * In-memory stand-in for the pg client used by the spiritual handlers.
 * Predicates are taken from the SQL text, so a query that drops `user_id`
 * returns other people's rows and the IDOR tests fail.
 */

type Row = Record<string, unknown>;

type QueryResult = { rows: Row[]; rowCount: number };

function result(rows: Row[], rowCount = rows.length): QueryResult {
  return { rows, rowCount };
}

function relationError(table: string) {
  const error = new Error(`relation "${table}" does not exist`) as Error & { code: string };
  error.code = "42P01";
  return error;
}

function uniqueError() {
  const error = new Error('duplicate key value violates unique constraint "user_reading_plans_one_active"') as Error & {
    code: string;
  };
  error.code = "23505";
  return error;
}

function paramIndex(text: string, column: string) {
  const match = new RegExp(`(?:\\b[a-z]\\.)?${column} = \\$(\\d+)`).exec(text);
  return match ? Number(match[1]) : null;
}

function param(text: string, params: unknown[], column: string) {
  const index = paramIndex(text, column);
  return index == null ? undefined : params[index - 1];
}

function filterUser(rows: Row[], text: string, params: unknown[]) {
  const userId = param(text, params, "user_id");
  if (userId === undefined) return rows;
  return rows.filter((row) => Number(row.user_id) === Number(userId));
}

function same(left: unknown, right: unknown) {
  return left === right || (left != null && right != null && String(left) === String(right));
}

export type TestUser = {
  user_id: number;
  email: string;
  display_name: string | null;
  profile_photo: string | null;
  supabase_user_id: string;
  session_token: string;
  jwt: string;
};

export const TEST_USERS: Record<"a" | "b", TestUser> = {
  a: {
    user_id: 1,
    email: "a@example.com",
    display_name: "User A",
    profile_photo: null,
    supabase_user_id: "sb-user-a",
    session_token: "session-user-a",
    jwt: "jwt-user-a",
  },
  b: {
    user_id: 2,
    email: "b@example.com",
    display_name: "User B",
    profile_photo: null,
    supabase_user_id: "sb-user-b",
    session_token: "session-user-b",
    jwt: "jwt-user-b",
  },
};

export class MemoryDb {
  users: TestUser[] = [];
  profiles: Row[] = [];
  prayers: Row[] = [];
  plans: Row[] = [];
  progress: Row[] = [];
  checkins: Row[] = [];
  missing = new Set<string>();
  private nextPrayerId = 1;
  private nextPlanId = 1;
  private nextCheckinId = 1;

  seedUsers() {
    this.users = [TEST_USERS.a, TEST_USERS.b];
  }

  supabaseIdForJwt(jwt: string) {
    return this.users.find((user) => user.jwt === jwt)?.supabase_user_id ?? null;
  }

  client() {
    return {
      connect: async () => undefined,
      query: async (sql: string, params: unknown[] = []) => this.query(sql, params),
      end: async () => undefined,
    };
  }

  query(sql: string, params: unknown[] = []): QueryResult {
    const text = sql.replace(/\s+/g, " ").trim();
    if (/\bbible_/.test(text)) throw relationError("bible");
    for (const table of [
      "user_faith_profiles",
      "prayer_requests",
      "worship_checkins",
      "user_reading_plans",
      "user_reading_progress",
    ]) {
      if (this.missing.has(table) && text.includes(table)) throw relationError(table);
    }

    if (text.includes("FROM app_sessions")) return this.sessionUser(params);
    if (text.includes("FROM app_users")) return this.userBySupabase(text, params);
    if (text.startsWith("SELECT tradition, translation, show_calendar")) return this.selectProfile(text, params);
    if (text.startsWith("INSERT INTO user_faith_profiles")) return this.upsertProfile(params);
    if (text.includes("count(*) FILTER") && text.includes("prayer_requests")) return this.prayerCounts(text, params);
    if (text.startsWith("INSERT INTO prayer_requests")) return this.insertPrayer(params);
    if (text.startsWith("UPDATE prayer_requests")) return this.updatePrayers(text, params);
    if (text.startsWith("DELETE FROM prayer_requests")) return this.deletePrayers(text, params);
    if (text.includes("FROM prayer_requests")) return this.selectPrayers(text, params);
    if (text.startsWith("INSERT INTO worship_checkins")) return this.upsertCheckin(params);
    if (text.startsWith("DELETE FROM worship_checkins")) return this.deleteCheckins(text, params);
    if (text.includes("SELECT church_name FROM worship_checkins")) return this.lastChurch(text, params);
    if (text.includes("FROM worship_checkins")) return this.selectCheckins(text, params);
    if (text.startsWith("SELECT user_plan_id, day_number, status")) return this.selectProgress(text, params);
    if (text.includes("AS handled")) return this.countProgress(text, params);
    if (text.startsWith("INSERT INTO user_reading_progress") && text.includes("unnest")) return this.insertSkipped(params);
    if (text.startsWith("INSERT INTO user_reading_progress")) return this.upsertProgress(params);
    if (text.startsWith("DELETE FROM user_reading_progress")) return this.deleteProgress(text, params);
    if (text.startsWith("INSERT INTO user_reading_plans")) return this.insertPlan(params);
    if (text.startsWith("SELECT 1 FROM user_reading_plans")) return this.selectOtherActive(text, params);
    if (text.startsWith("UPDATE user_reading_plans")) return this.updatePlans(text, params);
    if (text.includes("FROM user_reading_plans")) return this.selectPlans(text, params);
    throw new Error(`Unhandled SQL in spiritual test db: ${text}`);
  }

  private sessionUser(params: unknown[]) {
    const token = String(params[0] ?? "");
    const user = this.users.find((item) => item.session_token === token);
    if (!user) return result([]);
    return result([this.publicUser(user)]);
  }

  private userBySupabase(text: string, params: unknown[]) {
    const id = param(text, params, "supabase_user_id");
    const user = this.users.find((item) => item.supabase_user_id === id);
    if (!user) return result([]);
    return result([this.publicUser(user)]);
  }

  private publicUser(user: TestUser) {
    return {
      user_id: user.user_id,
      email: user.email,
      display_name: user.display_name,
      profile_photo: user.profile_photo,
    };
  }

  private selectProfile(text: string, params: unknown[]) {
    return result(filterUser(this.profiles, text, params).map((row) => ({ ...row })));
  }

  private upsertProfile(params: unknown[]) {
    const [userId, tradition, translation, showCalendar] = params;
    let row = this.profiles.find((item) => Number(item.user_id) === Number(userId));
    if (!row) {
      row = { user_id: Number(userId) };
      this.profiles.push(row);
    }
    row.tradition = tradition;
    row.translation = translation;
    row.show_calendar = showCalendar;
    row.updated_at = new Date().toISOString();
    return result([{ tradition: row.tradition, translation: row.translation, show_calendar: row.show_calendar }]);
  }

  private prayerCounts(text: string, params: unknown[]) {
    const rows = filterUser(this.prayers, text, params);
    const active = rows.filter((row) => row.archived_at == null && row.answered_on == null).length;
    const answered = rows.filter((row) => row.archived_at == null && row.answered_on != null).length;
    const archived = rows.filter((row) => row.archived_at != null).length;
    return result([{ active, answered, archived }]);
  }

  private insertPrayer(params: unknown[]) {
    const [userId, title, notes, person, category, createdOn] = params;
    const row: Row = {
      prayer_id: this.nextPrayerId++,
      user_id: Number(userId),
      title,
      notes,
      person,
      category,
      created_on: createdOn,
      answered_on: null,
      answer_note: null,
      archived_at: null,
      updated_at: new Date().toISOString(),
    };
    this.prayers.push(row);
    return result([{ ...row }]);
  }

  private updatePrayers(text: string, params: unknown[]) {
    const where = text.slice(text.indexOf(" WHERE "));
    const setPart = text.slice(text.indexOf(" SET ") + 5, text.indexOf(" WHERE "));
    let rows = filterUser(this.prayers, where, params);
    const prayerId = param(where, params, "prayer_id");
    if (prayerId !== undefined) rows = rows.filter((row) => same(row.prayer_id, prayerId));
    for (const row of rows) this.applySets(row, setPart, params);
    return result(rows.map((row) => ({ ...row })));
  }

  private deletePrayers(text: string, params: unknown[]) {
    const where = text.slice(text.indexOf(" WHERE "));
    const doomed = new Set(this.matchingPrayers(where, params));
    const before = this.prayers.length;
    this.prayers = this.prayers.filter((row) => !doomed.has(row));
    return result([], before - this.prayers.length);
  }

  private matchingPrayers(where: string, params: unknown[]) {
    let rows = filterUser(this.prayers, where, params);
    const prayerId = param(where, params, "prayer_id");
    if (prayerId !== undefined) rows = rows.filter((row) => same(row.prayer_id, prayerId));
    return rows;
  }

  private selectPrayers(text: string, params: unknown[]) {
    let rows = filterUser(this.prayers, text, params);
    if (text.includes("archived_at IS NULL AND answered_on IS NULL")) {
      rows = rows.filter((row) => row.archived_at == null && row.answered_on == null);
    } else if (text.includes("archived_at IS NULL AND answered_on IS NOT NULL")) {
      rows = rows.filter((row) => row.archived_at == null && row.answered_on != null);
    } else if (text.includes("archived_at IS NOT NULL")) {
      rows = rows.filter((row) => row.archived_at != null);
    }
    rows = [...rows].sort((a, b) => {
      if (text.includes("ORDER BY answered_on DESC")) {
        return String(b.answered_on).localeCompare(String(a.answered_on)) || Number(b.prayer_id) - Number(a.prayer_id);
      }
      if (text.includes("ORDER BY archived_at DESC")) {
        return String(b.archived_at).localeCompare(String(a.archived_at));
      }
      return String(b.created_on).localeCompare(String(a.created_on)) || Number(b.prayer_id) - Number(a.prayer_id);
    });
    const limitParam = /LIMIT \$(\d+)/.exec(text);
    const limit = limitParam ? Number(params[Number(limitParam[1]) - 1]) : text.includes("LIMIT 100") ? 100 : rows.length;
    return result(rows.slice(0, limit).map((row) => ({ ...row })));
  }

  private upsertCheckin(params: unknown[]) {
    const [userId, week, attendance, church, passage, notes, takeaway] = params;
    let row = this.checkins.find((item) => Number(item.user_id) === Number(userId) && item.week_start === week);
    if (!row) {
      row = { checkin_id: this.nextCheckinId++, user_id: Number(userId), week_start: week };
      this.checkins.push(row);
    }
    Object.assign(row, {
      attendance,
      church_name: church,
      sermon_passage: passage,
      notes,
      takeaway,
      updated_at: new Date().toISOString(),
    });
    return result([]);
  }

  private deleteCheckins(text: string, params: unknown[]) {
    const week = param(text, params, "week_start");
    const before = this.checkins.length;
    this.checkins = this.checkins.filter((row) => {
      if (!filterUser([row], text, params).length) return true;
      if (week !== undefined && !same(row.week_start, week)) return true;
      return false;
    });
    return result([], before - this.checkins.length);
  }

  private lastChurch(text: string, params: unknown[]) {
    const rows = filterUser(this.checkins, text, params)
      .filter((row) => row.church_name != null && row.church_name !== "")
      .sort((a, b) => String(b.week_start).localeCompare(String(a.week_start)));
    return result(rows.slice(0, 1).map((row) => ({ church_name: row.church_name })));
  }

  private selectCheckins(text: string, params: unknown[]) {
    let rows = filterUser(this.checkins, text, params);
    const ceiling = /week_start <= \$(\d+)/.exec(text);
    if (ceiling) {
      const max = String(params[Number(ceiling[1]) - 1]);
      rows = rows.filter((row) => String(row.week_start) <= max);
    }
    rows = [...rows].sort((a, b) => String(b.week_start).localeCompare(String(a.week_start)));
    return result(rows.slice(0, 60).map((row) => ({ ...row })));
  }

  private selectProgress(text: string, params: unknown[]) {
    let rows = filterUser(this.progress, text, params);
    const any = /user_plan_id = ANY\(\$(\d+)::int\[\]\)/.exec(text);
    if (any) {
      const ids = new Set((params[Number(any[1]) - 1] as unknown[]).map((id) => Number(id)));
      rows = rows.filter((row) => ids.has(Number(row.user_plan_id)));
    }
    return result(rows.map((row) => ({ user_plan_id: row.user_plan_id, day_number: row.day_number, status: row.status })));
  }

  private countProgress(text: string, params: unknown[]) {
    let rows = filterUser(this.progress, text, params);
    const planId = param(text, params, "user_plan_id");
    if (planId !== undefined) rows = rows.filter((row) => same(row.user_plan_id, planId));
    const max = /day_number <= \$(\d+)/.exec(text);
    if (max) rows = rows.filter((row) => Number(row.day_number) <= Number(params[Number(max[1]) - 1]));
    return result([{ handled: rows.length }]);
  }

  private insertSkipped(params: unknown[]) {
    const [userPlanId, userId, days, markedOn] = params as [number, number, number[], string];
    for (const day of days) {
      if (this.progress.some((row) => same(row.user_plan_id, userPlanId) && same(row.day_number, day))) continue;
      this.progress.push({
        user_plan_id: Number(userPlanId),
        user_id: Number(userId),
        day_number: Number(day),
        status: "skipped",
        marked_on: markedOn,
      });
    }
    return result([]);
  }

  private upsertProgress(params: unknown[]) {
    const [userPlanId, userId, day, status, markedOn] = params;
    let row = this.progress.find((item) => same(item.user_plan_id, userPlanId) && same(item.day_number, day));
    if (!row) {
      row = { user_plan_id: Number(userPlanId), user_id: Number(userId), day_number: Number(day) };
      this.progress.push(row);
    }
    row.status = status;
    row.marked_on = markedOn;
    return result([]);
  }

  private deleteProgress(text: string, params: unknown[]) {
    const planId = param(text, params, "user_plan_id");
    const day = param(text, params, "day_number");
    const before = this.progress.length;
    this.progress = this.progress.filter((row) => {
      if (!filterUser([row], text, params).length) return true;
      if (planId !== undefined && !same(row.user_plan_id, planId)) return true;
      if (day !== undefined && !same(row.day_number, day)) return true;
      return false;
    });
    return result([], before - this.progress.length);
  }

  private insertPlan(params: unknown[]) {
    const [userId, planKey, startOn, includeDc] = params;
    const duplicate = this.plans.some(
      (row) => Number(row.user_id) === Number(userId) && row.plan_key === planKey && row.status === "active",
    );
    if (duplicate) throw uniqueError();
    const row: Row = {
      user_plan_id: this.nextPlanId++,
      user_id: Number(userId),
      plan_key: planKey,
      start_on: startOn,
      include_deuterocanon: Boolean(includeDc),
      status: "active",
      completed_at: null,
      updated_at: new Date().toISOString(),
    };
    this.plans.push(row);
    return result([{ user_plan_id: row.user_plan_id }]);
  }

  private selectOtherActive(text: string, params: unknown[]) {
    const planKey = param(text, params, "plan_key");
    const excluded = /user_plan_id <> \$(\d+)/.exec(text);
    let rows = filterUser(this.plans, text, params).filter((row) => row.status === "active");
    if (planKey !== undefined) rows = rows.filter((row) => row.plan_key === planKey);
    if (excluded) rows = rows.filter((row) => !same(row.user_plan_id, params[Number(excluded[1]) - 1]));
    return result(rows.map(() => ({ "?column?": 1 })));
  }

  private updatePlans(text: string, params: unknown[]) {
    const where = text.slice(text.indexOf(" WHERE "));
    const setPart = text.slice(text.indexOf(" SET ") + 5, text.indexOf(" WHERE "));
    let rows = filterUser(this.plans, where, params);
    const planId = param(where, params, "user_plan_id");
    if (planId !== undefined) rows = rows.filter((row) => same(row.user_plan_id, planId));
    // The reopen query mentions another row's `o.status = 'active'` in a subquery.
    const outerWhere = where.split(" AND NOT EXISTS ")[0] ?? where;
    if (outerWhere.includes("status = 'active'")) rows = rows.filter((row) => row.status === "active");
    if (outerWhere.includes("status = 'completed'")) {
      rows = rows.filter((row) => row.status === "completed");
      if (text.includes("NOT EXISTS")) {
        rows = rows.filter(
          (row) =>
            !this.plans.some(
              (other) =>
                other !== row &&
                Number(other.user_id) === Number(row.user_id) &&
                other.plan_key === row.plan_key &&
                other.status === "active",
            ),
        );
      }
    }
    for (const row of rows) {
      if (setPart.includes("status = 'completed'")) {
        row.status = "completed";
        row.completed_at = row.completed_at || new Date().toISOString();
      } else if (setPart.includes("status = 'stopped'")) {
        row.status = "stopped";
      } else if (setPart.includes("status = 'active'")) {
        row.status = "active";
        row.completed_at = null;
      }
      const start = /start_on = \$(\d+)/.exec(setPart);
      if (start) row.start_on = params[Number(start[1]) - 1];
      row.updated_at = new Date().toISOString();
    }
    return result([]);
  }

  private selectPlans(text: string, params: unknown[]) {
    const where = text.split(" ORDER BY ")[0] ?? text;
    let rows = filterUser(this.plans, where, params);
    const planId = param(where, params, "user_plan_id");
    if (planId !== undefined) rows = rows.filter((row) => same(row.user_plan_id, planId));
    if (where.includes("status = 'active'")) rows = rows.filter((row) => row.status === "active");
    if (text.includes("ORDER BY")) {
      rows = [...rows].sort((a, b) => {
        const active = Number(b.status === "active") - Number(a.status === "active");
        if (active) return active;
        return String(b.updated_at).localeCompare(String(a.updated_at));
      });
    }
    const limited = text.includes("LIMIT 20") ? rows.slice(0, 20) : rows;
    return result(limited.map((row) => ({ ...row })));
  }

  private applySets(row: Row, setPart: string, params: unknown[]) {
    for (const assignment of setPart.split(",")) {
      const match = /^\s*(\w+)\s*=\s*(.+?)\s*$/.exec(assignment);
      if (!match) throw new Error(`Unhandled assignment in spiritual test db: ${assignment}`);
      const column = match[1]!;
      const expr = match[2]!;
      if (expr === "NOW()") row[column] = new Date().toISOString();
      else if (expr === "NULL") row[column] = null;
      else {
        const ref = /^\$(\d+)$/.exec(expr);
        if (!ref) throw new Error(`Unhandled assignment in spiritual test db: ${assignment}`);
        row[column] = params[Number(ref[1]) - 1];
      }
    }
  }
}

export function installFaithTestDb(db: MemoryDb) {
  (globalThis as { __faithTestDb?: MemoryDb }).__faithTestDb = db;
}

export function faithTestDb() {
  const db = (globalThis as { __faithTestDb?: MemoryDb }).__faithTestDb;
  if (!db) throw new Error("Faith test database is not initialized.");
  return db;
}
