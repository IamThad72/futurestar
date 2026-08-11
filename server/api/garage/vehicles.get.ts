import { createError } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId, groupAccessClause, soloUserClause } from "../../utils/group";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const access = groupId ? groupAccessClause() : soloUserClause();
    const params = groupId ? [userId, groupId] : [userId];
    const result = await client.query(
      `SELECT vh_id, year, make, model, vin, value, age, description, trust_designated, user_id, group_id
       FROM asset_vehicles
       WHERE ${access}
       ORDER BY year DESC NULLS LAST, make ASC, model ASC`,
      params,
    );
    return { vehicles: result.rows };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to load garage vehicles.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
