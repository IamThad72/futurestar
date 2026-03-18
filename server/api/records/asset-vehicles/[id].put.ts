import { createError, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId } from "../../../utils/group";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const id = getRouterParam(event, "id");
  if (!id || !/^\d+$/.test(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid record ID." });
  }

  const body = await readBody(event);
  const year = body?.year != null ? Number(body.year) : null;
  const make = String(body?.make ?? "").trim() || null;
  const model = String(body?.model ?? "").trim() || null;
  const vin = String(body?.vin ?? "").trim() || null;
  const value = body?.value != null ? Number(body.value) : null;
  const age = body?.age != null ? Number(body.age) : null;
  const description = String(body?.description ?? "").trim() || null;
  const trustDesignated = body?.trust_designated === true || body?.trust_designated === "Y" || body?.trust_designated === "y";

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const params = groupId
      ? [year, make, model, vin, value, age, description, trustDesignated, id, userId, groupId]
      : [year, make, model, vin, value, age, description, trustDesignated, id, userId];

    const result = await client.query(
      groupId
        ? `UPDATE asset_vehicles SET year = $1, make = $2, model = $3, vin = $4, value = $5, age = $6, description = $7, trust_designated = $8 WHERE vh_id = $9 AND (user_id = $10 OR group_id = $11)`
        : `UPDATE asset_vehicles SET year = $1, make = $2, model = $3, vin = $4, value = $5, age = $6, description = $7, trust_designated = $8 WHERE vh_id = $9 AND user_id = $10`,
      params,
    );

    if (result.rowCount === 0) throw createError({ statusCode: 404, statusMessage: "Record not found." });
    return { success: true };
  } catch (e) {
    if (e?.statusCode) throw e;
    throw createError({ statusCode: 500, statusMessage: "Failed to update record." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
