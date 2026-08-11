import { createError } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId, groupAccessClauseAt, soloUserClauseAt } from "../../../utils/group";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const id = getRouterParam(event, "id");
  if (!id || !/^\d+$/.test(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid service record ID." });
  }

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const accessParams = groupId ? [id, userId, groupId] : [id, userId];
    const vehicleAccess = groupId
      ? groupAccessClauseAt("v", 2, 3)
      : soloUserClauseAt("v", 2);

    const result = await client.query(
      `DELETE FROM vehicle_service_records s
       USING asset_vehicles v
       WHERE s.vsr_id = $1
         AND s.vh_id = v.vh_id
         AND ${vehicleAccess}`,
      accessParams,
    );

    if (!result.rowCount) {
      throw createError({ statusCode: 404, statusMessage: "Service record not found." });
    }
    return { success: true };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to delete service record.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
