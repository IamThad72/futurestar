/**
 * In-memory stand-in for the account-deletion transaction.
 * Deletes cascade the way the reviewed SQL says app_users does, and
 * groups.created_by still cascades until the restrict migration is applied.
 * A query the server does not send fails the test instead of returning empty.
 */

type Row = Record<string, unknown>;

export type AccountUser = {
  user_id: number;
  email: string;
  display_name: string | null;
  profile_photo: string | null;
  password_hash: string | null;
  supabase_user_id: string | null;
};

type SessionRow = { session_token: string; user_id: number; expires_at: string };
type GroupRow = { group_id: number; group_name: string; created_by: number };
type MemberRow = { group_id: number; user_id: number; role: string; created_at: string };

const DEFAULT_COLUMNS: Record<string, string[]> = {
  budgets: ["user_id", "group_id"],
  budget_transactions: ["user_id", "group_id"],
  estate_documents: ["user_id", "group_id"],
  income_sources: ["user_id", "group_id"],
  prayer_requests: ["user_id"],
  workouts: ["user_id"],
  nutrition_intake_entries: ["user_id"],
  tax_household_profiles: ["user_id", "group_id", "household_key"],
  tax_deduction_overrides: ["user_id", "household_key"],
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function result(rows: Row[], rowCount = rows.length) {
  return { rows, rowCount };
}

export class AccountDeletionDb {
  users: AccountUser[] = [];
  sessions: SessionRow[] = [];
  groups: GroupRow[] = [];
  members: MemberRow[] = [];
  rows: Record<string, Row[]> = {};
  columns: Record<string, string[]> = clone(DEFAULT_COLUMNS);
  failDeleteUser = false;
  private jwtToSupabase = new Map<string, string>();
  private snapshots: string[] = [];

  supabaseIdForJwt(jwt: string) {
    return this.jwtToSupabase.get(jwt) ?? null;
  }

  trustJwt(jwt: string, supabaseUserId: string) {
    this.jwtToSupabase.set(jwt, supabaseUserId);
  }

  constructor() {
    for (const table of Object.keys(this.columns)) this.rows[table] = [];
  }

  client() {
    return {
      connect: async () => undefined,
      query: async (sql: string, params: unknown[] = []) => this.query(sql, params),
      end: async () => undefined,
    };
  }

  query(sql: string, params: unknown[] = []) {
    const text = sql.replace(/\s+/g, " ").trim();
    if (text === "BEGIN") {
      this.snapshots.push(JSON.stringify(this.capture()));
      return result([]);
    }
    if (text === "COMMIT") {
      this.snapshots.pop();
      return result([]);
    }
    if (text === "ROLLBACK") {
      const saved = this.snapshots.pop();
      if (saved) this.restore(JSON.parse(saved));
      return result([]);
    }
    if (text.includes("information_schema.columns")) return this.columnRows(params);
    if (text.includes("FROM app_sessions")) return this.sessionUser(params);
    if (text.includes("password_hash") && text.includes("FROM app_users")) return this.lockUser(params);
    if (text.includes("supabase_user_id") && text.includes("FROM app_users")) return this.userBySupabase(params);
    if (text.includes("FROM group_members gm")) return this.membership(params);
    if (text.startsWith("SELECT created_by FROM groups")) return this.createdBy(params);
    if (text.includes("FROM group_members") && text.includes("WHERE group_id")) return this.memberList(params);
    if (text.includes("SELECT storage_path, storage_backend")) return this.estateFiles(params);
    if (text.startsWith("UPDATE groups SET created_by")) return this.updateCreatedBy(params);
    if (text.includes("SET role = 'owner'")) return this.setRole(params, "owner");
    if (text.includes("SET role = 'member'")) return this.setRole(params, "member");
    if (text.startsWith("UPDATE") && text.includes("NOT EXISTS")) return this.reownSkippingNames(text, params);
    if (text.startsWith("UPDATE") && text.includes("household_key")) return this.reownByHouseholdKey(text, params);
    if (text.startsWith("UPDATE") && text.includes("SET user_id")) return this.reownByGroup(text, params);
    if (text.startsWith("DELETE FROM app_users") || text.includes("DELETE FROM app_users")) return this.deleteUser(params);
    if (text.startsWith("DELETE FROM groups") || text.includes("DELETE FROM groups WHERE")) return this.deleteGroup(params);
    if (text.startsWith("DELETE FROM") && text.includes("household_key")) return this.deleteByHouseholdKey(text, params);
    if (text.startsWith("DELETE FROM")) return this.deleteByGroup(text, params);
    throw new Error(`Unhandled SQL in account deletion test db: ${text}`);
  }

  private capture() {
    return {
      users: this.users,
      sessions: this.sessions,
      groups: this.groups,
      members: this.members,
      rows: this.rows,
    };
  }

  private restore(saved: ReturnType<AccountDeletionDb["capture"]>) {
    this.users = saved.users;
    this.sessions = saved.sessions;
    this.groups = saved.groups;
    this.members = saved.members;
    this.rows = saved.rows;
  }

  private columnRows(params: unknown[]) {
    const requested = Array.isArray(params[0]) ? params[0].map(String) : [];
    const rows: Row[] = [];
    for (const table of requested) {
      for (const column of this.columns[table] ?? []) {
        if (column === "user_id" || column === "group_id" || column === "household_key") {
          rows.push({ table_name: table, column_name: column });
        }
      }
    }
    return result(rows);
  }

  private sessionUser(params: unknown[]) {
    const token = String(params[0] ?? "");
    const session = this.sessions.find((item) => item.session_token === token);
    if (!session || Date.parse(session.expires_at) <= Date.now()) return result([]);
    const user = this.users.find((item) => item.user_id === session.user_id);
    if (!user) return result([]);
    return result([this.publicUser(user)]);
  }

  private lockUser(params: unknown[]) {
    const user = this.users.find((item) => item.user_id === Number(params[0]));
    if (!user) return result([]);
    return result([
      {
        user_id: user.user_id,
        email: user.email,
        password_hash: user.password_hash,
        supabase_user_id: user.supabase_user_id,
      },
    ]);
  }

  private userBySupabase(params: unknown[]) {
    const user = this.users.find((item) => item.supabase_user_id === params[0]);
    if (!user) return result([]);
    return result([this.publicUser(user)]);
  }

  private publicUser(user: AccountUser) {
    return {
      user_id: user.user_id,
      email: user.email,
      display_name: user.display_name,
      profile_photo: user.profile_photo,
    };
  }

  private membership(params: unknown[]) {
    const userId = Number(params[0]);
    const memberships = this.members
      .filter((item) => item.user_id === userId)
      .sort((left, right) => left.created_at.localeCompare(right.created_at) || left.user_id - right.user_id);
    const membership = memberships[0];
    if (!membership) return result([]);
    const group = this.groups.find((item) => item.group_id === membership.group_id);
    if (!group) return result([]);
    return result([{ group_id: group.group_id, role: membership.role, group_name: group.group_name }]);
  }

  private createdBy(params: unknown[]) {
    const group = this.groups.find((item) => item.group_id === Number(params[0]));
    if (!group) return result([]);
    return result([{ created_by: group.created_by }]);
  }

  private memberList(params: unknown[]) {
    const groupId = Number(params[0]);
    const members = this.members
      .filter((item) => item.group_id === groupId)
      .sort((left, right) => left.created_at.localeCompare(right.created_at) || left.user_id - right.user_id)
      .map((item) => ({ user_id: item.user_id, role: item.role, created_at: item.created_at }));
    return result(members);
  }

  private estateFiles(params: unknown[]) {
    const userId = Number(params[0]);
    const dissolve = params[1] === true;
    const groupId = Number(params[2]);
    const rows = (this.rows.estate_documents ?? []).filter((row) => {
      const solo = Number(row.user_id) === userId && (row.group_id == null);
      const household = dissolve && Number(row.group_id) === groupId;
      return solo || household;
    });
    return result(rows.map((row) => ({ storage_path: row.storage_path, storage_backend: row.storage_backend })));
  }

  private updateCreatedBy(params: unknown[]) {
    const group = this.groups.find((item) => item.group_id === Number(params[1]));
    if (!group) return result([], 0);
    group.created_by = Number(params[0]);
    return result([], 1);
  }

  private setRole(params: unknown[], role: "owner" | "member") {
    const groupId = Number(params[0]);
    const userId = Number(params[1]);
    let count = 0;
    for (const member of this.members) {
      if (member.group_id !== groupId || member.user_id !== userId) continue;
      if (role === "member" && member.role !== "owner") continue;
      member.role = role;
      count += 1;
    }
    return result([], count);
  }

  private tableName(text: string) {
    const match = /(?:UPDATE|DELETE FROM) "?([a-z_][a-z0-9_]*)"?/.exec(text);
    if (!match) throw new Error(`Could not read table name: ${text}`);
    return match[1] as string;
  }

  private reownByGroup(text: string, params: unknown[]) {
    const table = this.tableName(text);
    const [newOwner, oldOwner, groupId] = params.map(Number);
    let count = 0;
    for (const row of this.rows[table] ?? []) {
      if (Number(row.user_id) !== oldOwner || Number(row.group_id) !== groupId) continue;
      row.user_id = newOwner;
      count += 1;
    }
    return result([], count);
  }

  private reownSkippingNames(text: string, params: unknown[]) {
    const table = this.tableName(text);
    const [newOwner, oldOwner, groupId] = params.map(Number);
    const rows = this.rows[table] ?? [];
    let count = 0;
    for (const row of rows) {
      if (Number(row.user_id) !== oldOwner || Number(row.group_id) !== groupId) continue;
      const clash = rows.some(
        (other) =>
          Number(other.user_id) === newOwner &&
          Number(other.group_id ?? 0) === Number(row.group_id ?? 0) &&
          String(other.name ?? "").toLowerCase() === String(row.name ?? "").toLowerCase(),
      );
      if (clash) continue;
      row.user_id = newOwner;
      count += 1;
    }
    return result([], count);
  }

  private reownByHouseholdKey(text: string, params: unknown[]) {
    const table = this.tableName(text);
    const newOwner = Number(params[0]);
    const oldOwner = Number(params[1]);
    const key = String(params[2] ?? "");
    let count = 0;
    for (const row of this.rows[table] ?? []) {
      if (Number(row.user_id) !== oldOwner || String(row.household_key) !== key) continue;
      row.user_id = newOwner;
      count += 1;
    }
    return result([], count);
  }

  private deleteByGroup(text: string, params: unknown[]) {
    const table = this.tableName(text);
    const groupId = Number(params[0]);
    const before = this.rows[table] ?? [];
    this.rows[table] = before.filter((row) => Number(row.group_id) !== groupId);
    return result([], before.length - this.rows[table].length);
  }

  private deleteByHouseholdKey(text: string, params: unknown[]) {
    const table = this.tableName(text);
    const key = String(params[0] ?? "");
    const before = this.rows[table] ?? [];
    this.rows[table] = before.filter((row) => String(row.household_key) !== key);
    return result([], before.length - this.rows[table].length);
  }

  private deleteGroup(params: unknown[]) {
    const groupId = Number(params[0]);
    const existed = this.groups.some((item) => item.group_id === groupId);
    this.groups = this.groups.filter((item) => item.group_id !== groupId);
    this.members = this.members.filter((item) => item.group_id !== groupId);
    for (const rows of Object.values(this.rows)) {
      for (const row of rows) {
        if (Number(row.group_id) === groupId) row.group_id = null;
      }
    }
    return result([], existed ? 1 : 0);
  }

  private deleteUser(params: unknown[]) {
    if (this.failDeleteUser) {
      const error = new Error("simulated user delete failure") as Error & { code: string };
      error.code = "XX000";
      throw error;
    }
    const userId = Number(params[0]);
    const doomedGroups = this.groups.filter((item) => item.created_by === userId).map((item) => item.group_id);
    for (const groupId of doomedGroups) this.deleteGroup([groupId]);
    this.users = this.users.filter((item) => item.user_id !== userId);
    this.sessions = this.sessions.filter((item) => item.user_id !== userId);
    this.members = this.members.filter((item) => item.user_id !== userId);
    for (const [table, rows] of Object.entries(this.rows)) {
      this.rows[table] = rows.filter((row) => Number(row.user_id) !== userId);
    }
    return result([], 1);
  }
}
