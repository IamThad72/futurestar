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
  queries: string[] = [];
  relations = new Set(["deleted_auth_users", "pending_storage_deletes", "account_deletion_attempts"]);
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
    this.rows.deleted_auth_users = [];
    this.rows.pending_storage_deletes = [];
    this.rows.account_deletion_attempts = [];
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
    this.queries.push(text);
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
    if (text.includes("to_regclass")) return this.regclass(params);
    if (text.includes("COUNT(DISTINCT group_id)")) return this.groupCount(params);
    if (text.includes("COUNT(*)") && text.includes("FROM group_members")) return this.memberCount(params);
    if (text.includes("FROM group_members") && text.includes("group_id <>")) return this.otherHousehold(params);
    if (text.includes("FROM account_deletion_attempts") && text.includes("ip_hash =")) return this.attemptCount("ip", params);
    if (text.includes("FROM account_deletion_attempts") && text.includes("user_id =")) return this.attemptCount("user", params);
    if (text.startsWith("INSERT INTO account_deletion_attempts")) return this.insertAttempt(params);
    if (text.startsWith("INSERT INTO deleted_auth_users")) return this.insertTombstone(params);
    if (text.startsWith("INSERT INTO pending_storage_deletes")) return this.insertPendingFile(params);
    if (text.startsWith("UPDATE deleted_auth_users")) return this.touchTombstone(text, params);
    if (text.startsWith("UPDATE pending_storage_deletes")) return this.touchPendingFile(text, params);
    if (text.includes("FROM deleted_auth_users")) return this.selectTombstone(params);
    if (text.includes("FROM pending_storage_deletes")) return this.selectPendingFiles();
    if (text.includes("FROM app_users") && text.includes("WHERE email")) return this.userByEmail(params);
    if (text.startsWith("INSERT INTO app_users")) return this.insertAppUser(params);
    if (text.startsWith("INSERT INTO groups")) return this.insertGroup(params);
    if (text.startsWith("INSERT INTO group_members")) return this.insertMembers(params);
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

  private regclass(params: unknown[]) {
    const name = String(params[0] ?? "");
    const table = name.split(".").pop() ?? name;
    return result([{ rel: this.relations.has(table) ? name : null }]);
  }

  private memberCount(params: unknown[]) {
    const groupId = Number(params[0]);
    return result([{ cnt: this.members.filter((item) => item.group_id === groupId).length }]);
  }

  private groupCount(params: unknown[]) {
    const userId = Number(params[0]);
    const ids = new Set(this.members.filter((item) => item.user_id === userId).map((item) => item.group_id));
    return result([{ groups: ids.size }]);
  }

  private otherHousehold(params: unknown[]) {
    const userId = Number(params[0]);
    const allowed = params[1] == null ? null : Number(params[1]);
    const row = this.members.find((item) => item.user_id === userId && (allowed == null || Number.isNaN(allowed) || item.group_id !== allowed));
    return result(row ? [{ group_id: row.group_id }] : []);
  }

  private recentFailures(kind: "user" | "ip", value: unknown) {
    const cutoff = Date.now() - 15 * 60 * 1000;
    return (this.rows.account_deletion_attempts ?? []).filter((row) => {
      if (row.succeeded === true) return false;
      const at = Date.parse(String(row.attempted_at ?? ""));
      if (Number.isFinite(at) && at <= cutoff) return false;
      if (kind === "user") return Number(row.user_id) === Number(value);
      return String(row.ip_hash) === String(value);
    }).length;
  }

  private attemptCount(kind: "user" | "ip", params: unknown[]) {
    return result([{ failures: this.recentFailures(kind, params[0]) }]);
  }

  private insertAttempt(params: unknown[]) {
    this.rows.account_deletion_attempts.push({
      user_id: Number(params[0]),
      ip_hash: String(params[1]),
      succeeded: false,
      attempted_at: new Date().toISOString(),
    });
    return result([], 1);
  }

  private insertTombstone(params: unknown[]) {
    const id = String(params[0]);
    if (!this.rows.deleted_auth_users.some((row) => row.supabase_user_id === id)) {
      this.rows.deleted_auth_users.push({
        supabase_user_id: id,
        app_user_id: Number(params[1]),
        auth_deleted_at: null,
        attempt_count: 0,
      });
    }
    return result([], 1);
  }

  private insertPendingFile(params: unknown[]) {
    const storagePath = String(params[0]);
    const backend = String(params[1]);
    const exists = this.rows.pending_storage_deletes.some(
      (row) => row.storage_path === storagePath && row.storage_backend === backend,
    );
    if (!exists) {
      this.rows.pending_storage_deletes.push({
        storage_path: storagePath,
        storage_backend: backend,
        deleted_at: null,
        attempt_count: 0,
      });
    }
    return result([], 1);
  }

  private touchTombstone(text: string, params: unknown[]) {
    const row = this.rows.deleted_auth_users.find((item) => item.supabase_user_id === String(params[0]) && item.auth_deleted_at == null);
    if (!row) return result([], 0);
    row.attempt_count = Number(row.attempt_count ?? 0) + 1;
    row.last_attempt_at = new Date().toISOString();
    if (text.includes("auth_deleted_at = NOW()")) row.auth_deleted_at = new Date().toISOString();
    return result([], 1);
  }

  private touchPendingFile(text: string, params: unknown[]) {
    const row = this.rows.pending_storage_deletes.find(
      (item) => item.storage_path === String(params[0]) && item.storage_backend === String(params[1]) && item.deleted_at == null,
    );
    if (!row) return result([], 0);
    row.attempt_count = Number(row.attempt_count ?? 0) + 1;
    if (text.includes("deleted_at = NOW()")) row.deleted_at = new Date().toISOString();
    return result([], 1);
  }

  private selectTombstone(params: unknown[]) {
    const rows = this.rows.deleted_auth_users.filter((row) => row.supabase_user_id === String(params[0]));
    return result(rows.map((row) => ({ ...row })));
  }

  private selectPendingFiles() {
    return result(this.rows.pending_storage_deletes.filter((row) => row.deleted_at == null).map((row) => ({ ...row })));
  }

  private userByEmail(params: unknown[]) {
    const email = String(params[0] ?? "").toLowerCase();
    const user = this.users.find((item) => item.email.toLowerCase() === email);
    if (!user) return result([]);
    return result([this.publicUser(user)]);
  }

  private insertAppUser(params: unknown[]) {
    const user: AccountUser = {
      user_id: this.users.length + 10,
      email: String(params[0]),
      display_name: params[1] == null ? null : String(params[1]),
      profile_photo: null,
      password_hash: null,
      supabase_user_id: String(params[2]),
    };
    this.users.push(user);
    return result([this.publicUser(user)]);
  }

  private insertGroup(params: unknown[]) {
    const groupId = this.groups.reduce((max, group) => Math.max(max, group.group_id), 0) + 1;
    this.groups.push({ group_id: groupId, group_name: String(params[0]), created_by: Number(params[1]) });
    return result([{ group_id: groupId }]);
  }

  private insertMembers(params: unknown[]) {
    const groupId = Number(params[0]);
    const pairs = [
      [params[1], params[2]],
      [params[3], params[4]],
    ];
    for (const [userId, role] of pairs) {
      if (userId == null) continue;
      this.members.push({
        group_id: groupId,
        user_id: Number(userId),
        role: String(role),
        created_at: new Date().toISOString(),
      });
    }
    return result([], 1);
  }
}
