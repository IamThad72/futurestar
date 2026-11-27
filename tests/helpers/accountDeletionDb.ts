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
  relations = new Set([
    "deleted_auth_users",
    "pending_storage_deletes",
    "account_deletion_attempts",
    "deleted_user_private_rows",
    "asset_inventory",
    "asset_vehicles",
    "cash_and_investments",
  ]);
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
    this.rows.deleted_user_private_rows = [];
    this.rows.asset_inventory = [];
    this.rows.asset_vehicles = [];
    this.rows.cash_and_investments = [];
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
    if (text.includes("pg_advisory_xact_lock")) return result([]);
    if (text.startsWith("DELETE FROM account_deletion_attempts") && text.includes("user_id =")) {
      return this.purgeAttempts(Number(params[0]));
    }
    if (text.startsWith("DELETE FROM account_deletion_attempts")) {
      const limit = text.match(/LIMIT (\d+)/);
      return this.purgeAttempts(undefined, limit ? Number(limit[1]) : undefined);
    }
    if (text.includes("SELECT role FROM group_members")) return this.memberRole(params);
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
    if (text.startsWith("SELECT") && text.includes("FROM group_members") && text.includes("WHERE group_id")) {
      return this.memberList(params);
    }
    if (text.includes("SELECT storage_path, storage_backend")) return this.estateFiles(params);
    if (text.startsWith("SELECT source_id, name")) return this.leavingSources(text, params);
    if (text.startsWith("SELECT name FROM")) return this.ownerSourceNames(text, params);
    if (text.startsWith("UPDATE groups SET created_by")) return this.updateCreatedBy(params);
    if (text.includes("SET role = 'owner'")) return this.setRole(params, "owner");
    if (text.includes("SET role = 'member'")) return this.setRole(params, "member");
    if (text.startsWith("UPDATE") && text.includes("source_id =")) return this.renameSource(text, params);
    if (text.startsWith("UPDATE") && text.includes("NOT EXISTS")) return this.reownSkippingNames(text, params);
    if (text.startsWith("UPDATE") && text.includes("household_key")) return this.reownByHouseholdKey(text, params);
    if (text.includes("SET user_id = NULL")) return this.detachPrivateAsset(text, params);
    if (text.startsWith("UPDATE") && text.includes("SET user_id")) return this.reownByGroup(text, params);
    if (text.includes("AS pk") && text.includes("group_id IS NULL")) return this.privateAssetPks(text, params);
    if (text.startsWith("INSERT INTO deleted_user_private_rows")) return this.insertPrivateHold(params);
    if (text.startsWith("SELECT id, table_name, row_pk")) return this.duePrivateHolds();
    if (text.startsWith("DELETE FROM deleted_user_private_rows")) return this.deletePrivateHold(params);
    if (text.startsWith("DELETE FROM \"asset_inventory\"")) return this.deleteAssetByPk("asset_inventory", "ai_id", params);
    if (text.startsWith("DELETE FROM \"asset_vehicles\"")) return this.deleteAssetByPk("asset_vehicles", "vh_id", params);
    if (text.startsWith("DELETE FROM \"cash_and_investments\"")) return this.deleteAssetByPk("cash_and_investments", "ci_id", params);
    if (text.startsWith("DELETE FROM group_members")) return this.deleteMember(params);
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

  private sourceTable(text: string) {
    const match = /FROM "?([a-z_][a-z0-9_]*)"?/.exec(text);
    if (!match) throw new Error(`Could not read source table: ${text}`);
    return match[1];
  }

  private leavingSources(text: string, params: unknown[]) {
    const table = this.sourceTable(text);
    const userId = Number(params[0]);
    const groupId = Number(params[1]);
    const rows = (this.rows[table] ?? [])
      .filter((row) => Number(row.user_id) === userId && Number(row.group_id) === groupId)
      .sort((a, b) => Number(a.source_id) - Number(b.source_id));
    return result(rows.map((row) => ({ source_id: row.source_id, name: row.name })));
  }

  private ownerSourceNames(text: string, params: unknown[]) {
    const table = this.sourceTable(text);
    const userId = Number(params[0]);
    const groupId = Number(params[1]);
    const rows = (this.rows[table] ?? []).filter(
      (row) => Number(row.user_id) === userId && Number(row.group_id ?? 0) === groupId,
    );
    return result(rows.map((row) => ({ name: row.name })));
  }

  private renameSource(text: string, params: unknown[]) {
    const table = this.tableName(text);
    const newOwner = Number(params[0]);
    const name = String(params[1] ?? "");
    const sourceId = Number(params[2]);
    const oldOwner = Number(params[3]);
    const row = (this.rows[table] ?? []).find(
      (item) => Number(item.source_id) === sourceId && Number(item.user_id) === oldOwner,
    );
    if (!row) return result([], 0);
    row.user_id = newOwner;
    row.name = name;
    return result([], 1);
  }

  private privateAssetPks(text: string, params: unknown[]) {
    const table = this.sourceTable(text);
    const userId = Number(params[0]);
    const rows = (this.rows[table] ?? []).filter(
      (row) => Number(row.user_id) === userId && (row.group_id == null || row.group_id === undefined),
    );
    return result(rows.map((row) => ({ pk: row.ai_id ?? row.vh_id ?? row.ci_id })));
  }

  private insertPrivateHold(params: unknown[]) {
    const tableName = String(params[0]);
    const rowPk = String(params[1]);
    const exists = (this.rows.deleted_user_private_rows ?? []).some(
      (row) => row.table_name === tableName && String(row.row_pk) === rowPk,
    );
    if (!exists) {
      this.rows.deleted_user_private_rows.push({
        id: this.rows.deleted_user_private_rows.length + 1,
        table_name: tableName,
        row_pk: rowPk,
        former_user_id: Number(params[2]),
        deleted_at: new Date().toISOString(),
        purge_after: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    return result([], exists ? 0 : 1);
  }

  private detachPrivateAsset(text: string, params: unknown[]) {
    const table = this.tableName(text);
    const pk = Number(params[0]);
    const userId = Number(params[1]);
    const row = (this.rows[table] ?? []).find((item) => {
      const id = Number(item.ai_id ?? item.vh_id ?? item.ci_id);
      return id === pk && Number(item.user_id) === userId && (item.group_id == null || item.group_id === undefined);
    });
    if (!row) return result([], 0);
    row.user_id = null;
    return result([], 1);
  }

  private duePrivateHolds() {
    const now = Date.now();
    const due = (this.rows.deleted_user_private_rows ?? [])
      .filter((row) => Date.parse(String(row.purge_after ?? "")) <= now)
      .slice(0, 500);
    return result(due.map((row) => ({ id: row.id, table_name: row.table_name, row_pk: row.row_pk })));
  }

  private deletePrivateHold(params: unknown[]) {
    const id = Number(params[0]);
    const before = this.rows.deleted_user_private_rows.length;
    this.rows.deleted_user_private_rows = this.rows.deleted_user_private_rows.filter((row) => Number(row.id) !== id);
    return result([], before - this.rows.deleted_user_private_rows.length);
  }

  private deleteAssetByPk(table: string, pkName: string, params: unknown[]) {
    const pk = Number(params[0]);
    const before = this.rows[table] ?? [];
    this.rows[table] = before.filter((row) => Number(row[pkName]) !== pk);
    return result([], before.length - this.rows[table].length);
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

  private deleteMember(params: unknown[]) {
    const groupId = Number(params[0]);
    const userId = Number(params[1]);
    const before = this.members.length;
    this.members = this.members.filter((item) => !(item.group_id === groupId && item.user_id === userId));
    return result([], before - this.members.length);
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
    const keptWithoutUserFk = new Set([
      "asset_inventory",
      "asset_vehicles",
      "cash_and_investments",
      "deleted_user_private_rows",
    ]);
    for (const [table, rows] of Object.entries(this.rows)) {
      if (keptWithoutUserFk.has(table)) continue;
      if (table === "record_shares") {
        this.rows[table] = rows.filter(
          (row) => Number(row.owner_user_id) !== userId && Number(row.shared_user_id) !== userId,
        );
        continue;
      }
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

  private purgeAttempts(userId?: number, limit?: number) {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const rows = this.rows.account_deletion_attempts ?? [];
    const doomed = rows.filter((row) => {
      if (userId != null && Number(row.user_id) !== userId) return false;
      const at = Date.parse(String(row.attempted_at ?? ""));
      return Number.isFinite(at) && at < cutoff;
    });
    const drop = new Set(limit == null ? doomed : doomed.slice(0, limit));
    const before = rows.length;
    this.rows.account_deletion_attempts = rows.filter((row) => !drop.has(row));
    return result([], before - this.rows.account_deletion_attempts.length);
  }

  private memberRole(params: unknown[]) {
    const groupId = Number(params[0]);
    const userId = Number(params[1]);
    const member = this.members.find((item) => item.group_id === groupId && item.user_id === userId);
    return result(member ? [{ role: member.role }] : []);
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
    const rows = this.rows.deleted_auth_users.filter((row) => {
      if (params[0] == null) return row.auth_deleted_at == null;
      return row.supabase_user_id === String(params[0]);
    });
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
