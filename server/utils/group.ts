import { createError } from "h3";

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
