import { createError } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getAccessibleVehicle } from "../../../utils/vehicleAccess";
import { getRecommendedServicesForVehicle } from "../../../utils/vehicleMaintenanceLookup";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const id = getRouterParam(event, "id");
  if (!id || !/^\d+$/.test(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid vehicle ID." });
  }

  const client = createDbClient();
  try {
    await client.connect();
    const { vehicle } = await getAccessibleVehicle(client, userId, Number(id));

    const knownRes = await client.query(
      `SELECT vsr_id, vh_id, service_name, service_date, mileage, cost, notes, created_at
       FROM vehicle_service_records
       WHERE vh_id = $1
       ORDER BY service_date DESC, vsr_id DESC`,
      [id],
    );

    const recommended = await getRecommendedServicesForVehicle(client, vehicle);

    return {
      vehicle,
      knownServices: knownRes.rows,
      recommendedServices: recommended.services,
      recommendedSource: recommended.source,
      recommendedUnavailableReason: recommended.unavailableReason,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to load vehicle details.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
