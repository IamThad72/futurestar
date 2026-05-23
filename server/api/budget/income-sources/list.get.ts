import { createError } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId, groupAccessClause, soloUserClause } from "../../../utils/group";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const accessClause = groupId ? groupAccessClause() : soloUserClause();
    const params = groupId ? [userId, groupId] : [userId];
    const result = await client.query(
      `SELECT source_id as id, name
       FROM income_sources
       WHERE ${accessClause}
       ORDER BY LOWER(name) ASC`,
      params,
    );

    return { sources: result.rows };
  } catch (error) {
    if (error?.statusCode) throw error;
    console.error("Failed to load income sources", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to load income sources.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
