import { createError, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId, groupAccessClauseAt, soloUserClauseAt } from "../../../utils/group";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const body = await readBody(event);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: "Name is required." });
  }

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const accessClause = groupId ? groupAccessClauseAt("", 2, 3) : soloUserClauseAt("", 2);
    const accessParams = groupId ? [userId, groupId] : [userId];

    const existing = await client.query(
      `SELECT source_id as id, name
       FROM income_sources
       WHERE LOWER(name) = LOWER($1) AND ${accessClause}
       LIMIT 1`,
      [name, ...accessParams],
    );
    if (existing.rowCount) {
      return { source: existing.rows[0] };
    }

    const created = await client.query(
      `INSERT INTO income_sources (user_id, group_id, name)
       VALUES ($1, $2, $3)
       RETURNING source_id as id, name`,
      [userId, groupId ?? null, name],
    );
    return { source: created.rows[0] };
  } catch (error) {
    if (error?.statusCode) throw error;
    console.error("Failed to submit income source", error);
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "Failed to submit income source.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
