import { createError } from "h3";
import { GROUP_SHARED_TABLES, getUserGroupMembership } from "./group";
import { verifyPassword } from "./password";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { removeEstateFile, type EstateDocBackend } from "./estateDocuments";
import { planAccountDeletion } from "~/utils/accountDeletionPlan.js";
import {
  DISSOLVE_DELETE_ORDER,
  HOUSEHOLD_DELETION_POLICY,
  HOUSEHOLD_TAX_TABLES,
  REOWN_HOUSEHOLD_TAX,
  REOWN_NAME_COLUMNS,
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
};

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

/**
 * Returns the fixed 400 message, or null when the typed email (and password,
 * when this account has one) matches. Supabase-only accounts have no
 * password_hash; the session already proved who they are.
 */
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
  if (input.passwordHash) {
    const password = typeof input.password === "string" ? input.password : "";
    if (!password) return "Enter your password to confirm.";
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
    const column = quoteIdent(nameColumn);
    await client.query(
      `UPDATE ${quoted} AS src
       SET user_id = $1
       WHERE src.user_id = $2
         AND src.group_id = $3
         AND NOT EXISTS (
           SELECT 1
           FROM ${quoted} AS existing
           WHERE existing.user_id = $1
             AND COALESCE(existing.group_id, 0) = COALESCE(src.group_id, 0)
             AND LOWER(existing.${column}) = LOWER(src.${column})
         )`,
      [newOwnerId, userId, groupId],
    );
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
 * Runs inside an open transaction. The caller commits, or rolls back on any throw.
 * The only user id is the one the caller already took from the session.
 */
export async function deleteAccountInTransaction(
  client: QueryClient,
  userId: number,
  input: { confirmEmail: unknown; password: unknown },
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

  const problem = confirmAccountDeletion({
    email: String(user.email ?? ""),
    confirmEmail: input.confirmEmail,
    password: input.password,
    passwordHash: user.password_hash == null || user.password_hash === "" ? null : String(user.password_hash),
  });
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem });
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

  await client.query(`DELETE FROM app_users WHERE user_id = $1`, [userId]);

  return {
    userId,
    supabaseUserId: user.supabase_user_id == null ? null : String(user.supabase_user_id),
    files,
  };
}

/** Best effort after commit. A storage or auth failure does not undo the deletion. */
export async function cleanupDeletedAccount(outcome: AccountDeletionOutcome): Promise<boolean> {
  for (const file of outcome.files) {
    try {
      await removeEstateFile(file.storagePath, file.backend);
    } catch {
      console.error("[auth/delete-account] storage cleanup failed", { userId: outcome.userId });
    }
  }

  if (!outcome.supabaseUserId) return false;

  try {
    const admin = getSupabaseAdmin();
    if (!admin) return false;
    const { error } = await admin.auth.admin.deleteUser(outcome.supabaseUserId, false);
    if (error) throw error;
    return true;
  } catch {
    console.error("[auth/delete-account] auth user removal failed", {
      userId: outcome.userId,
      supabaseUserId: outcome.supabaseUserId,
    });
    return false;
  }
}
