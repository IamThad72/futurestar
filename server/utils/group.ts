import { createError } from "h3";

type DbClient = {
  query: (queryText: string, values: unknown[]) => Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number }>;
};

/** Tables that share data across linked account group members. */
export const GROUP_SHARED_TABLES = [
  "asset_inventory",
  "asset_vehicles",
  "cash_and_investments",
  "debt",
  "insurance",
  "real_estate",
  "estate_entries",
  "income",
  "expenses",
  "budget_transactions",
  "income_sources",
  "investment_sources",
  "savings_sources",
] as const;

/** $1 = userId, $2 = groupId */
export const groupAccessClause = (alias = "") => {
  const prefix = alias ? `${alias}.` : "";
  return `(${prefix}user_id = $1 OR ${prefix}group_id = $2 OR ${prefix}user_id IN (SELECT user_id FROM group_members WHERE group_id = $2))`;
};

/** Same as groupAccessClause with explicit parameter indexes (for UPDATE/DELETE with other params first). */
export const groupAccessClauseAt = (alias = "", userParam = 1, groupParam = 2) => {
  const prefix = alias ? `${alias}.` : "";
  return `(${prefix}user_id = $${userParam} OR ${prefix}group_id = $${groupParam} OR ${prefix}user_id IN (SELECT user_id FROM group_members WHERE group_id = $${groupParam}))`;
};

export const soloUserClause = (alias = "") => {
  const prefix = alias ? `${alias}.` : "";
  return `${prefix}user_id = $1`;
};

export const soloUserClauseAt = (alias = "", userParam = 1) => {
  const prefix = alias ? `${alias}.` : "";
  return `${prefix}user_id = $${userParam}`;
};

export const backfillGroupIdForUser = async (client: DbClient, groupId: number, userId: number) => {
  for (const table of GROUP_SHARED_TABLES) {
    await client.query(`UPDATE ${table} SET group_id = $1 WHERE user_id = $2 AND group_id IS NULL`, [groupId, userId]);
  }
};

export const getUserGroupId = async (
  client: { query: (queryText: string, values: unknown[]) => Promise<{ rows: Array<{ group_id?: number }> }> },
  userId: number,
) => {
  const result = await client.query(
    `SELECT group_id
     FROM group_members
     WHERE user_id = $1
     ORDER BY created_at ASC
     LIMIT 1`,
    [userId],
  );

  return result.rows[0]?.group_id ?? null;
};

export const getUserGroupMembership = async (
  client: {
    query: (
      queryText: string,
      values: unknown[],
    ) => Promise<{ rows: Array<{ group_id?: number; role?: string; group_name?: string }> }>;
  },
  userId: number,
) => {
  const result = await client.query(
    `SELECT gm.group_id, gm.role, g.group_name
     FROM group_members gm
     JOIN groups g ON g.group_id = gm.group_id
     WHERE gm.user_id = $1
     ORDER BY gm.created_at ASC
     LIMIT 1`,
    [userId],
  );

  return result.rows[0] ?? null;
};

export const assertGroupOwner = async (
  client: {
    query: (
      queryText: string,
      values: unknown[],
    ) => Promise<{ rows: Array<{ group_id?: number; role?: string; group_name?: string }> }>;
  },
  userId: number,
) => {
  const membership = await getUserGroupMembership(client, userId);
  if (!membership?.group_id || membership.role !== "owner") {
    throw createError({
      statusCode: 403,
      statusMessage: "Only group owners can manage members.",
    });
  }

  return membership;
};
