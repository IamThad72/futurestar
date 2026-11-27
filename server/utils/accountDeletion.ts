import { createHash } from "node:crypto";
import { createError } from "h3";
import { GROUP_SHARED_TABLES, countUserGroups, getUserGroupMembership } from "./group";
import { verifyPassword } from "./password";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { supabasePasswordMatches } from "./supabasePassword";
import { removeEstateFile, type EstateDocBackend } from "./estateDocuments";
import { planAccountDeletion } from "~/utils/accountDeletionPlan.js";
import { bearerIsFresh, deletionAttemptBlocked } from "~/utils/deletionGuards.js";
import {
  DELETION_ATTEMPT_IP_LIMIT,
  DELETION_ATTEMPT_USER_LIMIT,
  DISSOLVE_DELETE_ORDER,
  HOUSEHOLD_DELETION_POLICY,
  HOUSEHOLD_TAX_TABLES,
  REAUTH_WINDOW_MS,
  REOWN_HOUSEHOLD_TAX,
  REOWN_NAME_COLUMNS,
  renamedSourceName,
  householdKeyForGroup,
  isSafeIdentifier,
} from "~/utils/accountDeletionPolicy.js";

type QueryClient = {
  query: (
    queryText: string,
    values?: unknown[],
  ) => Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
};

type ColumnShape = { userId: boolean; groupId: boolean; householdKey: boolean };

export type DeletedEstateFile = {
  storagePath: string;
  backend: EstateDocBackend;
};

export type AccountDeletionOutcome = {
  userId: number;
  supabaseUserId: string | null;
  files: DeletedEstateFile[];
  verifiedPasswordHash: string;
};

export type CleanupResult = {
  authUserRemoved: boolean;
  authRemovalPending: boolean;
};

export const MULTIPLE_HOUSEHOLDS_MESSAGE =
  "This account is in more than one household. In Linked Accounts, make someone else the owner of each extra household, leave those households, and then delete the account.";

export const MIGRATION_ATTEMPTS = "scripts/create_account_deletion_attempts.sql";
export const MIGRATION_TOMBSTONE = "scripts/create_deleted_auth_users.sql";
export const MIGRATION_STORAGE = "scripts/create_pending_storage_deletes.sql";
export const MIGRATION_PRIVATE_ROWS = "scripts/create_deleted_user_private_rows.sql";
export const MIGRATION_HOLD_CHILDREN = "scripts/alter_hold_child_user_id_nullable.sql";

/** Private rows with no user_id foreign key. group_id null is kept 90 days, then purged. */
const PRIVATE_HOLD_TABLES = [
  { table: "asset_inventory", pk: "ai_id" },
  { table: "asset_vehicles", pk: "vh_id" },
  { table: "cash_and_investments", pk: "ci_id" },
] as const;

const PRIVATE_PURGE_BATCH = 500;

/**
 * Children of a held parent. They are not queued on their own: the parent row
 * is the retention clock, and these foreign keys already cascade when the
 * parent is deleted. user_id is cleared first so app_users CASCADE does not
 * erase them on the day the account is deleted.
 */
const PRIVATE_HOLD_CHILDREN = [
  {
    parent: "cash_and_investments",
    parentPk: "ci_id",
    child: "investment_positions",
    childPk: "position_id",
    childFk: "ci_id",
  },
  {
    parent: "asset_vehicles",
    parentPk: "vh_id",
    child: "vehicle_service_records",
    childPk: "vsr_id",
    childFk: "vh_id",
  },
] as const;

export function missingMigrationError(script: string) {
  return createError({
    statusCode: 500,
    statusMessage: `Account deletion is not ready. Run ${script} before deleting accounts.`,
  });
}

const SHARED_TABLES = new Set<string>(GROUP_SHARED_TABLES);
const TAX_TABLES = new Map(HOUSEHOLD_TAX_TABLES.map((item) => [item.table, item.match]));

function quoteIdent(name: string) {
  if (!isSafeIdentifier(name)) {
    throw createError({ statusCode: 500, statusMessage: "Could not delete the account." });
  }
  return `"${name}"`;
}

function canTouch(table: string) {
  return isSafeIdentifier(table) && (SHARED_TABLES.has(table) || TAX_TABLES.has(table));
}

export function deletionIpHash(ip: string) {
  return createHash("sha256").update(`futurestar-delete:${ip || "unknown"}`).digest("hex");
}

/** Short hash for logs. The raw path or sign-in id is not written. */
export function deletionLogRef(value: string) {
  return createHash("sha256").update(`futurestar-delete-log:${value}`).digest("hex").slice(0, 12);
}

/** How many old throttle rows the daily job deletes in one run. */
const ATTEMPT_PURGE_BATCH = 500;

/** Email must match. A password is always required. Local hashes are checked here. */
export function confirmAccountDeletion(input: {
  email: string;
  confirmEmail: unknown;
  password: unknown;
  passwordHash: string | null;
}) {
  const expected = String(input.email ?? "").trim().toLowerCase();
  const typed = String(input.confirmEmail ?? "").trim().toLowerCase();
  if (!expected || typed !== expected) {
    return "Type your account email to confirm.";
  }
  const password = typeof input.password === "string" ? input.password : "";
  if (!password) return "Enter your password to confirm.";
  if (input.passwordHash) {
    let matches = false;
    try {
      matches = verifyPassword(password, input.passwordHash);
    } catch {
      matches = false;
    }
    if (!matches) return "Enter your password to confirm.";
  }
  return null;
}

async function relationExists(client: QueryClient, name: string) {
  const result = await client.query(`SELECT to_regclass($1) AS rel`, [name]);
  return Boolean(result.rows[0]?.rel);
}

export async function assertDeletionNotThrottled(client: QueryClient, userId: number, ipHash: string) {
  if (!(await relationExists(client, "public.account_deletion_attempts"))) {
    throw missingMigrationError(MIGRATION_ATTEMPTS);
  }
  await client.query(`SELECT pg_advisory_xact_lock($1::int)`, [userId]);
  // This request only drops this person's rows older than a day. The 15-minute
  // count does not include them anyway. The daily cron sweeps every user.
  await client.query(
    `DELETE FROM account_deletion_attempts
     WHERE user_id = $1 AND attempted_at < NOW() - INTERVAL '1 day'`,
    [userId],
  );
  const byUser = await client.query(
    `SELECT COUNT(*)::int AS failures
     FROM account_deletion_attempts
     WHERE user_id = $1 AND succeeded = FALSE AND attempted_at > NOW() - INTERVAL '15 minutes'`,
    [userId],
  );
  const byIp = await client.query(
    `SELECT COUNT(*)::int AS failures
     FROM account_deletion_attempts
     WHERE ip_hash = $1 AND succeeded = FALSE AND attempted_at > NOW() - INTERVAL '15 minutes'`,
    [ipHash],
  );
  const blocked = deletionAttemptBlocked(byUser.rows[0]?.failures, byIp.rows[0]?.failures, {
    userLimit: DELETION_ATTEMPT_USER_LIMIT,
    ipLimit: DELETION_ATTEMPT_IP_LIMIT,
  });
  if (blocked) {
    throw createError({ statusCode: 429, statusMessage: "Too many attempts. Try again later." });
  }
}

export async function recordDeletionFailure(client: QueryClient, userId: number, ipHash: string) {
  if (!(await relationExists(client, "public.account_deletion_attempts"))) {
    throw missingMigrationError(MIGRATION_ATTEMPTS);
  }
  await client.query(
    `INSERT INTO account_deletion_attempts (user_id, ip_hash) VALUES ($1, $2)`,
    [userId, ipHash],
  );
}

/**
 * Fresh credential for a Supabase-only account (no local password_hash).
 * Uses the existing Supabase project's password sign-in. A bearer token, when
 * present, must also have been issued within REAUTH_WINDOW_MS.
 */
export async function assertSupabaseReauth(input: {
  email: string;
  password: string;
  bearerToken: string | null;
  nowMs?: number;
  checkPassword?: boolean;
}) {
  if (input.bearerToken) {
    const fresh = bearerIsFresh(input.bearerToken, input.nowMs ?? Date.now(), REAUTH_WINDOW_MS);
    if (!fresh) {
      throw createError({ statusCode: 401, statusMessage: "Sign in again to delete your account." });
    }
  }
  if (input.checkPassword === false) return;
  const matches = await supabasePasswordMatches(input.email, input.password);
  if (!matches) {
    throw createError({ statusCode: 400, statusMessage: "Enter your password to confirm." });
  }
}

function orderedDissolveTables(present: string[]) {
  const remaining = new Set(present);
  const ordered: string[] = [];
  for (const table of DISSOLVE_DELETE_ORDER) {
    if (remaining.has(table)) {
      ordered.push(table);
      remaining.delete(table);
    }
  }
  for (const table of present) {
    if (remaining.has(table)) ordered.push(table);
  }
  return ordered;
}

async function reownGroupRows(
  client: QueryClient,
  table: string,
  newOwnerId: number,
  userId: number,
  groupId: number,
) {
  const quoted = quoteIdent(table);
  const nameColumn = REOWN_NAME_COLUMNS[table as keyof typeof REOWN_NAME_COLUMNS];
  if (nameColumn && isSafeIdentifier(nameColumn)) {
    const leaving = await client.query(
      `SELECT source_id, name
       FROM ${quoted}
       WHERE user_id = $1 AND group_id = $2
       ORDER BY source_id`,
      [userId, groupId],
    );
    const held = await client.query(
      `SELECT name
       FROM ${quoted}
       WHERE user_id = $1 AND COALESCE(group_id, 0) = $2`,
      [newOwnerId, groupId],
    );
    const taken = held.rows.map((row) => String(row.name ?? ""));
    for (const row of leaving.rows) {
      let nextName: string;
      try {
        nextName = renamedSourceName(String(row.name ?? ""), taken);
      } catch {
        throw createError({ statusCode: 500, statusMessage: "Could not delete the account." });
      }
      taken.push(nextName);
      await client.query(
        `UPDATE ${quoted}
         SET user_id = $1, name = $2
         WHERE source_id = $3 AND user_id = $4`,
        [newOwnerId, nextName, Number(row.source_id), userId],
      );
    }
    return;
  }
  await client.query(
    `UPDATE ${quoted} SET user_id = $1 WHERE user_id = $2 AND group_id = $3`,
    [newOwnerId, userId, groupId],
  );
}

async function collectEstateFiles(
  client: QueryClient,
  columns: Map<string, ColumnShape>,
  userId: number,
  groupId: number | null,
) {
  const shape = columns.get("estate_documents");
  if (!shape?.userId || !canTouch("estate_documents")) return [];
  const result = await client.query(
    `SELECT storage_path, storage_backend
     FROM estate_documents
     WHERE (user_id = $1 AND group_id IS NULL)
        OR ($2::boolean IS TRUE AND group_id = $3)`,
    [userId, groupId != null, groupId],
  );
  const files: DeletedEstateFile[] = [];
  for (const row of result.rows) {
    const storagePath = String(row.storage_path ?? "");
    const backend = String(row.storage_backend ?? "");
    if (!storagePath) continue;
    if (backend !== "disk" && backend !== "supabase") continue;
    files.push({ storagePath, backend });
  }
  return files;
}

/**
 * Private asset, vehicle, and cash rows have no foreign key to app_users.
 * Clear user_id so a later account cannot inherit them, and remember the row
 * until purge_after. Household rows are already reowned or deleted by group_id.
 */
async function assertHoldChildNullable(client: QueryClient, table: string) {
  const found = await client.query(
    `SELECT is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'user_id'`,
    [table],
  );
  if (String(found.rows[0]?.is_nullable ?? "") === "NO") {
    throw missingMigrationError(MIGRATION_HOLD_CHILDREN);
  }
}

/** Clear user_id on holdings and service rows of private parents before those parents are detached. */
async function detachPrivateHoldChildren(client: QueryClient, userId: number) {
  for (const spec of PRIVATE_HOLD_CHILDREN) {
    if (!(await relationExists(client, `public.${spec.child}`))) continue;
    if (!(await relationExists(client, `public.${spec.parent}`))) continue;
    await assertHoldChildNullable(client, spec.child);
    const childFk = quoteIdent(spec.childFk);
    const parentPk = quoteIdent(spec.parentPk);
    await client.query(
      `UPDATE ${quoteIdent(spec.child)}
       SET user_id = NULL
       WHERE user_id = $1
         AND ${childFk} IN (
           SELECT ${parentPk} FROM ${quoteIdent(spec.parent)}
           WHERE user_id = $1 AND group_id IS NULL
         )`,
      [userId],
    );
  }
}

function holdChildOf(parent: string) {
  return PRIVATE_HOLD_CHILDREN.find((item) => item.parent === parent);
}

async function heldChildrenRemain(client: QueryClient, parent: string, parentPk: string) {
  const spec = holdChildOf(parent);
  if (!spec) return false;
  if (!(await relationExists(client, `public.${spec.child}`))) return false;
  const count = await client.query(
    `SELECT COUNT(*)::int AS n
     FROM ${quoteIdent(spec.child)}
     WHERE ${quoteIdent(spec.childFk)} = $1::bigint`,
    [parentPk],
  );
  return Number(count.rows[0]?.n ?? 0) > 0;
}

async function deleteHeldChildren(client: QueryClient, parent: string, parentPk: string, limit: number) {
  const spec = holdChildOf(parent);
  if (!spec || limit <= 0) return { table: spec?.child ?? parent, count: 0 };
  if (!(await relationExists(client, `public.${spec.child}`))) return { table: spec.child, count: 0 };
  const childPk = quoteIdent(spec.childPk);
  const deleted = await client.query(
    `DELETE FROM ${quoteIdent(spec.child)}
     WHERE ${childPk} IN (
       SELECT ${childPk}
       FROM ${quoteIdent(spec.child)}
       WHERE ${quoteIdent(spec.childFk)} = $1::bigint
       ORDER BY ${childPk}
       LIMIT $2
     )`,
    [parentPk, limit],
  );
  return { table: spec.child, count: Number(deleted.rowCount ?? 0) };
}

async function holdPrivateAssetRows(client: QueryClient, userId: number) {
  if (!(await relationExists(client, "public.deleted_user_private_rows"))) {
    throw missingMigrationError(MIGRATION_PRIVATE_ROWS);
  }
  await detachPrivateHoldChildren(client, userId);
  for (const spec of PRIVATE_HOLD_TABLES) {
    if (!(await relationExists(client, `public.${spec.table}`))) continue;
    const table = quoteIdent(spec.table);
    const pk = quoteIdent(spec.pk);
    const found = await client.query(
      `SELECT ${pk} AS pk FROM ${table} WHERE user_id = $1 AND group_id IS NULL`,
      [userId],
    );
    for (const row of found.rows) {
      const rowPk = String(row.pk ?? "");
      if (!rowPk) continue;
      await client.query(
        `INSERT INTO deleted_user_private_rows (table_name, row_pk, former_user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (table_name, row_pk) DO NOTHING`,
        [spec.table, rowPk, userId],
      );
      await client.query(
        `UPDATE ${table} SET user_id = NULL WHERE ${pk} = $1::bigint AND user_id = $2 AND group_id IS NULL`,
        [row.pk, userId],
      );
    }
  }
}

/**
 * Runs inside an open transaction. The caller commits, or rolls back on any throw.
 * The only user id is the one the caller already took from the session.
 */
export async function deleteAccountInTransaction(
  client: QueryClient,
  userId: number,
  input: { confirmEmail: unknown; verifiedPasswordHash: string },
): Promise<AccountDeletionOutcome> {
  if (HOUSEHOLD_DELETION_POLICY !== "keep-shared") {
    throw createError({ statusCode: 500, statusMessage: "Account deletion is not available." });
  }

  const userResult = await client.query(
    `SELECT user_id, email, password_hash, supabase_user_id
     FROM app_users
     WHERE user_id = $1
     FOR UPDATE`,
    [userId],
  );
  const user = userResult.rows[0];
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "Account not found." });
  }

  const currentHash = user.password_hash == null || user.password_hash === "" ? "" : String(user.password_hash);
  if (currentHash !== input.verifiedPasswordHash) {
    throw createError({ statusCode: 400, statusMessage: "Enter your password to confirm." });
  }
  const emailProblem = confirmAccountDeletion({
    email: String(user.email ?? ""),
    confirmEmail: input.confirmEmail,
    password: "already-checked",
    passwordHash: null,
  });
  if (emailProblem) {
    throw createError({ statusCode: 400, statusMessage: emailProblem });
  }

  const households = await countUserGroups(client as Parameters<typeof countUserGroups>[0], userId);
  if (households > 1) {
    throw createError({ statusCode: 409, statusMessage: MULTIPLE_HOUSEHOLDS_MESSAGE });
  }

  const membership = await getUserGroupMembership(client as Parameters<typeof getUserGroupMembership>[0], userId);
  let groupId: number | null = null;
  let createdBy: number | null = null;
  let members: Array<{ user_id: number; role: string; created_at: unknown }> = [];

  if (membership?.group_id) {
    groupId = Number(membership.group_id);
    const groupResult = await client.query(
      `SELECT created_by FROM groups WHERE group_id = $1 FOR UPDATE`,
      [groupId],
    );
    const rawCreatedBy = groupResult.rows[0]?.created_by;
    createdBy = rawCreatedBy == null ? null : Number(rawCreatedBy);
    const memberResult = await client.query(
      `SELECT user_id, role, created_at
       FROM group_members
       WHERE group_id = $1
       ORDER BY created_at ASC, user_id ASC`,
      [groupId],
    );
    members = memberResult.rows.map((row) => ({
      user_id: Number(row.user_id),
      role: String(row.role ?? ""),
      created_at: row.created_at,
    }));
  }

  const plan = planAccountDeletion(userId, members, { createdBy });
  if (groupId != null && plan.mode === "solo") {
    throw createError({ statusCode: 500, statusMessage: "Could not delete the account." });
  }
  if ((plan.mode === "promote" || plan.mode === "reown") && plan.reownToUserId == null) {
    throw createError({ statusCode: 500, statusMessage: "Could not delete the account." });
  }
  if (plan.mode === "promote" && plan.newOwnerId == null) {
    throw createError({ statusCode: 500, statusMessage: "Could not delete the account." });
  }
  if (groupId != null && createdBy === userId && plan.mode !== "dissolve" && plan.newOwnerId == null) {
    throw createError({ statusCode: 500, statusMessage: "Could not delete the account." });
  }

  const tableNames = [...SHARED_TABLES, ...TAX_TABLES.keys()];
  const columnResult = await client.query(
    `SELECT c.table_name, c.column_name
     FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.column_name IN ('user_id', 'group_id', 'household_key')
       AND c.table_name = ANY($1::text[])`,
    [tableNames],
  );
  const columns = new Map<string, ColumnShape>();
  for (const row of columnResult.rows) {
    const table = String(row.table_name ?? "");
    const column = String(row.column_name ?? "");
    if (!canTouch(table)) continue;
    const shape = columns.get(table) ?? { userId: false, groupId: false, householdKey: false };
    if (column === "user_id") shape.userId = true;
    if (column === "group_id") shape.groupId = true;
    if (column === "household_key") shape.householdKey = true;
    columns.set(table, shape);
  }

  const householdKey = groupId == null ? null : householdKeyForGroup(groupId);

  if (plan.mode === "promote" && plan.newOwnerId != null && groupId != null) {
    await client.query(`UPDATE groups SET created_by = $1 WHERE group_id = $2`, [plan.newOwnerId, groupId]);
    await client.query(
      `UPDATE group_members SET role = 'owner' WHERE group_id = $1 AND user_id = $2`,
      [groupId, plan.newOwnerId],
    );
    await client.query(
      `UPDATE group_members SET role = 'member' WHERE group_id = $1 AND user_id = $2 AND role = 'owner'`,
      [groupId, userId],
    );
  }

  if ((plan.mode === "reown" || plan.mode === "promote") && plan.reownToUserId != null && groupId != null) {
    for (const table of tableNames) {
      if (!canTouch(table)) continue;
      const shape = columns.get(table);
      if (!shape?.userId) continue;
      const taxMatch = TAX_TABLES.get(table);
      if (taxMatch && !REOWN_HOUSEHOLD_TAX) continue;
      if (taxMatch === "household_key") {
        if (!shape.householdKey || !householdKey) continue;
        await client.query(
          `UPDATE ${quoteIdent(table)} SET user_id = $1 WHERE user_id = $2 AND household_key = $3`,
          [plan.reownToUserId, userId, householdKey],
        );
        continue;
      }
      if (!shape.groupId) continue;
      await reownGroupRows(client, table, plan.reownToUserId, userId, groupId);
    }
  }

  const dissolveGroupId = plan.mode === "dissolve" ? groupId : null;
  const files = await collectEstateFiles(client, columns, userId, dissolveGroupId);

  if (dissolveGroupId != null && householdKey) {
    const groupTables = tableNames.filter((table) => canTouch(table) && columns.get(table)?.groupId);
    for (const table of orderedDissolveTables(groupTables)) {
      await client.query(`DELETE FROM ${quoteIdent(table)} WHERE group_id = $1`, [dissolveGroupId]);
    }
    const overrides = columns.get("tax_deduction_overrides");
    if (overrides?.householdKey && canTouch("tax_deduction_overrides")) {
      await client.query(`DELETE FROM tax_deduction_overrides WHERE household_key = $1`, [householdKey]);
    }
    await client.query(`DELETE FROM groups WHERE group_id = $1`, [dissolveGroupId]);
  }

  await holdPrivateAssetRows(client, userId);

  const supabaseUserId = user.supabase_user_id == null ? null : String(user.supabase_user_id);
  if (supabaseUserId) {
    if (!(await relationExists(client, "public.deleted_auth_users"))) {
      throw missingMigrationError(MIGRATION_TOMBSTONE);
    }
    await client.query(
      `INSERT INTO deleted_auth_users (supabase_user_id, app_user_id)
       VALUES ($1, $2)
       ON CONFLICT (supabase_user_id) DO NOTHING`,
      [supabaseUserId, userId],
    );
  }
  if (files.length) {
    if (!(await relationExists(client, "public.pending_storage_deletes"))) {
      throw missingMigrationError(MIGRATION_STORAGE);
    }
    for (const file of files) {
      await client.query(
        `INSERT INTO pending_storage_deletes (storage_path, storage_backend)
         VALUES ($1, $2)
         ON CONFLICT (storage_backend, storage_path) DO NOTHING`,
        [file.storagePath, file.backend],
      );
    }
  }

  await client.query(`DELETE FROM app_users WHERE user_id = $1`, [userId]);

  return {
    userId,
    supabaseUserId,
    files,
    verifiedPasswordHash: input.verifiedPasswordHash,
  };
}

async function markStorageAttempt(client: QueryClient, file: DeletedEstateFile, removed: boolean) {
  if (!(await relationExists(client, "public.pending_storage_deletes"))) return;
  if (removed) {
    await client.query(
      `UPDATE pending_storage_deletes
       SET deleted_at = NOW(), last_attempt_at = NOW(), attempt_count = attempt_count + 1
       WHERE storage_path = $1 AND storage_backend = $2 AND deleted_at IS NULL`,
      [file.storagePath, file.backend],
    );
    return;
  }
  await client.query(
    `UPDATE pending_storage_deletes
     SET last_attempt_at = NOW(), attempt_count = attempt_count + 1
     WHERE storage_path = $1 AND storage_backend = $2 AND deleted_at IS NULL`,
    [file.storagePath, file.backend],
  );
}

async function retryStorageDeletes(client: QueryClient, outcome: AccountDeletionOutcome) {
  for (const file of outcome.files) {
    try {
      await removeEstateFile(file.storagePath, file.backend);
      await markStorageAttempt(client, file, true);
    } catch {
      await markStorageAttempt(client, file, false);
      console.error("[auth/delete-account] storage cleanup failed", {
        backend: file.backend,
        ref: deletionLogRef(file.storagePath),
      });
    }
  }
}

/** Removes one Supabase Auth user and records the attempt on the tombstone. */
export async function retryAuthDeletion(client: QueryClient, supabaseUserId: string) {
  const hasTable = await relationExists(client, "public.deleted_auth_users");
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      if (hasTable) {
        await client.query(
          `UPDATE deleted_auth_users
           SET last_attempt_at = NOW(), attempt_count = attempt_count + 1
           WHERE supabase_user_id = $1 AND auth_deleted_at IS NULL`,
          [supabaseUserId],
        );
      }
      console.error("[auth/delete-account] auth user removal pending", {
        ref: deletionLogRef(supabaseUserId),
        reason: "no-service-role",
      });
      return false;
    }
    const { error } = await admin.auth.admin.deleteUser(supabaseUserId, false);
    if (error) throw error;
    if (hasTable) {
      await client.query(
        `UPDATE deleted_auth_users
         SET auth_deleted_at = NOW(), last_attempt_at = NOW(), attempt_count = attempt_count + 1
         WHERE supabase_user_id = $1 AND auth_deleted_at IS NULL`,
        [supabaseUserId],
      );
    }
    return true;
  } catch {
    if (hasTable) {
      await client.query(
        `UPDATE deleted_auth_users
         SET last_attempt_at = NOW(), attempt_count = attempt_count + 1
         WHERE supabase_user_id = $1 AND auth_deleted_at IS NULL`,
        [supabaseUserId],
      ).catch(() => undefined);
    }
    console.error("[auth/delete-account] auth user removal failed", {
      ref: deletionLogRef(supabaseUserId),
    });
    return false;
  }
}

/**
 * Drains queues left by account deletion. The Vercel cron runs once a day.
 * Each run retries up to 25 files and 25 sign-ins; the rest wait until the next day.
 * Rows in account_deletion_attempts older than a day are deleted here as well.
 */
export async function runAccountCleanup(client: QueryClient) {
  let filesRemoved = 0;
  let authUsersRemoved = 0;
  let attemptsPurged = 0;
  let privateRowsPurged = 0;

  if (await relationExists(client, "public.pending_storage_deletes")) {
    const pending = await client.query(
      `SELECT storage_path, storage_backend
       FROM pending_storage_deletes
       WHERE deleted_at IS NULL
       ORDER BY created_at ASC
       LIMIT 25`,
    );
    for (const row of pending.rows) {
      const backend = String(row.storage_backend ?? "");
      if (backend !== "disk" && backend !== "supabase") continue;
      const file = { storagePath: String(row.storage_path ?? ""), backend } as DeletedEstateFile;
      try {
        await removeEstateFile(file.storagePath, file.backend);
        await markStorageAttempt(client, file, true);
        filesRemoved += 1;
      } catch {
        await markStorageAttempt(client, file, false);
        console.error("[cron/account-cleanup] storage cleanup failed", {
          backend: file.backend,
          ref: deletionLogRef(file.storagePath),
        });
      }
    }
  }

  if (await relationExists(client, "public.deleted_auth_users")) {
    const pending = await client.query(
      `SELECT supabase_user_id, app_user_id
       FROM deleted_auth_users
       WHERE auth_deleted_at IS NULL
       ORDER BY created_at ASC
       LIMIT 25`,
    );
    for (const row of pending.rows) {
      const removed = await retryAuthDeletion(client, String(row.supabase_user_id ?? ""));
      if (removed) authUsersRemoved += 1;
    }
  }

  if (await relationExists(client, "public.account_deletion_attempts")) {
    const purged = await client.query(
      `DELETE FROM account_deletion_attempts
       WHERE attempt_id IN (
         SELECT attempt_id
         FROM account_deletion_attempts
         WHERE attempted_at < NOW() - INTERVAL '1 day'
         ORDER BY attempted_at
         LIMIT ${ATTEMPT_PURGE_BATCH}
       )`,
    );
    attemptsPurged = Number(purged.rowCount ?? 0);
  }

  if (await relationExists(client, "public.deleted_user_private_rows")) {
    const due = await client.query(
      `SELECT id, table_name, row_pk
       FROM deleted_user_private_rows
       WHERE purge_after <= NOW()
       ORDER BY purge_after, id
       LIMIT ${PRIVATE_PURGE_BATCH}`,
    );
    const purgedByTable = new Map<string, number>();
    let budget = PRIVATE_PURGE_BATCH;
    const note = (table: string, count: number) => {
      if (count <= 0) return;
      purgedByTable.set(table, (purgedByTable.get(table) ?? 0) + count);
      privateRowsPurged += count;
    };
    for (const row of due.rows) {
      if (budget <= 0) break;
      const spec = PRIVATE_HOLD_TABLES.find((item) => item.table === String(row.table_name ?? ""));
      if (!spec) continue;
      const parentPk = String(row.row_pk ?? "");
      while (budget > 0 && (await heldChildrenRemain(client, spec.table, parentPk))) {
        const removed = await deleteHeldChildren(client, spec.table, parentPk, budget);
        if (removed.count <= 0) break;
        budget -= removed.count;
        note(removed.table, removed.count);
      }
      if (await heldChildrenRemain(client, spec.table, parentPk)) break;
      if (budget <= 0) break;
      await client.query(
        `DELETE FROM ${quoteIdent(spec.table)} WHERE ${quoteIdent(spec.pk)} = $1::bigint`,
        [parentPk],
      );
      await client.query(`DELETE FROM deleted_user_private_rows WHERE id = $1`, [row.id]);
      budget -= 1;
      note(spec.table, 1);
    }
    for (const [table, count] of purgedByTable) {
      console.error("[cron/account-cleanup] private rows purged", { table, count });
    }
  }

  return { filesRemoved, authUsersRemoved, attemptsPurged, privateRowsPurged };
}

/** After commit. Storage and Auth failures stay pending and are retried. */
export async function cleanupDeletedAccount(client: QueryClient, outcome: AccountDeletionOutcome): Promise<CleanupResult> {
  await retryStorageDeletes(client, outcome);
  if (!outcome.supabaseUserId) {
    return { authUserRemoved: false, authRemovalPending: false };
  }
  const authUserRemoved = await retryAuthDeletion(client, outcome.supabaseUserId);
  return { authUserRemoved, authRemovalPending: !authUserRemoved };
}
