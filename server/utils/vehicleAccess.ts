import { createError } from "h3";
import { getUserGroupId, groupAccessClause, soloUserClause } from "./group";

type DbClient = {
  query: (
    queryText: string,
    values?: unknown[],
  ) => Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
};

export async function getAccessibleVehicle(client: DbClient, userId: number, vhId: number) {
  const groupId = await getUserGroupId(client, userId);
  const params = groupId ? [userId, groupId, vhId] : [userId, vhId];
  const access = groupId ? groupAccessClause() : soloUserClause();
  const idParam = groupId ? "$3" : "$2";
  const result = await client.query(
    `SELECT * FROM asset_vehicles WHERE vh_id = ${idParam} AND ${access}`,
    params,
  );
  const vehicle = result.rows[0];
  if (!vehicle) {
    throw createError({ statusCode: 404, statusMessage: "Vehicle not found." });
  }
  return { vehicle, groupId };
}
