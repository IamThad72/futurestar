import { createError, getCookie, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { SESSION_COOKIE_NAME } from "../../../utils/session";
import { getUserGroupId } from "../../../utils/group";

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, SESSION_COOKIE_NAME);
  if (!sessionToken) {
    throw createError({ statusCode: 401, statusMessage: "You must be logged in." });
  }

  const id = getRouterParam(event, "id");
  if (!id || !/^\d+$/.test(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid record ID." });
  }

  const body = await readBody(event);
  const number = String(body?.number ?? "").trim() || null;
  const street = String(body?.street ?? "").trim() || null;
  const city = String(body?.city ?? "").trim() || null;
  const state = String(body?.state ?? "").trim() || null;
  const zipcode = String(body?.zipcode ?? "").trim() || null;
  const value = body?.value != null ? Number(body.value) : null;
  const trustDesignated = body?.trust_designated === true || body?.trust_designated === "Y";

  const client = createDbClient();
  try {
    await client.connect();
    const sessionResult = await client.query(
      `SELECT user_id FROM app_sessions WHERE session_token = $1 AND expires_at > NOW()`,
      [sessionToken],
    );
    const userId = sessionResult.rows[0]?.user_id;
    if (!userId) throw createError({ statusCode: 401, statusMessage: "Session expired." });

    const groupId = await getUserGroupId(client, userId);
    const params = groupId
      ? [number, street, city, state, zipcode, value, trustDesignated, id, userId, groupId]
      : [number, street, city, state, zipcode, value, trustDesignated, id, userId];

    const result = await client.query(
      groupId
        ? `UPDATE real_estate SET number = $1, street = $2, city = $3, state = $4, zipcode = $5, value = $6, trust_designated = $7 WHERE re_id = $8 AND (user_id = $9 OR group_id = $10)`
        : `UPDATE real_estate SET number = $1, street = $2, city = $3, state = $4, zipcode = $5, value = $6, trust_designated = $7 WHERE re_id = $8 AND user_id = $9`,
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
