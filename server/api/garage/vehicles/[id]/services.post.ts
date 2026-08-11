import { createError, readBody } from "h3";
import { createDbClient } from "../../../../utils/db";
import { getSessionUserId } from "../../../../utils/auth";
import { getAccessibleVehicle } from "../../../../utils/vehicleAccess";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const id = getRouterParam(event, "id");
  if (!id || !/^\d+$/.test(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid vehicle ID." });
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
    const { groupId } = await getAccessibleVehicle(client, userId, Number(id));

    const result = await client.query(
      `INSERT INTO vehicle_service_records
        (vh_id, user_id, group_id, service_name, service_date, mileage, cost, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING vsr_id, vh_id, service_name, service_date, mileage, cost, notes, created_at`,
      [id, userId, groupId, serviceName, serviceDate, mileage, cost, notes || null],
    );

    return { success: true, record: result.rows[0] };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to save service record.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
