import { createError, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId, groupAccessClauseAt, soloUserClauseAt } from "../../../utils/group";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const id = getRouterParam(event, "id");
  if (!id || !/^\d+$/.test(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid service record ID." });
  }

  const body = await readBody(event);
  const serviceName = String(body?.service_name ?? "").trim();
  const serviceDate = String(body?.service_date ?? "").trim();
  const mileageRaw = body?.mileage;
  const costRaw = body?.cost;
  const notes = body?.notes != null ? String(body.notes).trim() : null;

  if (!serviceName) {
    throw createError({ statusCode: 400, statusMessage: "Service name is required." });
  }
  if (!serviceDate || Number.isNaN(new Date(serviceDate).getTime())) {
    throw createError({ statusCode: 400, statusMessage: "Valid service date is required." });
  }

  const mileage =
    mileageRaw !== undefined && mileageRaw !== null && mileageRaw !== ""
      ? Number(mileageRaw)
      : null;
  if (mileage != null && (!Number.isFinite(mileage) || mileage < 0)) {
    throw createError({ statusCode: 400, statusMessage: "Mileage must be a non-negative number." });
  }

  const cost =
    costRaw !== undefined && costRaw !== null && costRaw !== ""
      ? Number(String(costRaw).replace(/[$,]/g, ""))
      : null;
  if (cost != null && (!Number.isFinite(cost) || cost < 0)) {
    throw createError({ statusCode: 400, statusMessage: "Cost must be a non-negative number." });
  }

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);

    // Ensure the service belongs to an accessible vehicle
    const accessParams = groupId ? [id, userId, groupId] : [id, userId];
    const vehicleAccess = groupId
      ? groupAccessClauseAt("v", 2, 3)
      : soloUserClauseAt("v", 2);
    const owned = await client.query(
      `SELECT s.vsr_id
       FROM vehicle_service_records s
       JOIN asset_vehicles v ON v.vh_id = s.vh_id
       WHERE s.vsr_id = $1 AND ${vehicleAccess}`,
      accessParams,
    );
    if (!owned.rows[0]) {
      throw createError({ statusCode: 404, statusMessage: "Service record not found." });
    }

    const result = await client.query(
      `UPDATE vehicle_service_records
       SET service_name = $1, service_date = $2, mileage = $3, cost = $4, notes = $5
       WHERE vsr_id = $6
       RETURNING vsr_id, vh_id, service_name, service_date, mileage, cost, notes, created_at`,
      [serviceName, serviceDate, mileage, cost, notes || null, id],
    );

    return { success: true, record: result.rows[0] };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to update service record.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
