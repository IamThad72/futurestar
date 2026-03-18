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
  const classification = String(body?.classification_type ?? body?.asset_classification ?? body?.classification ?? "").trim();
  const title = String(body?.title ?? "").trim() || null;
  const description = String(body?.description ?? "").trim() || null;
  const rawValue = body?.value;
  const value = rawValue != null && rawValue !== ""
    ? (typeof rawValue === "number" ? rawValue : parseFloat(String(rawValue).replace(/[$,]/g, "")) || null)
    : null;
  const location = String(body?.location ?? "").trim() || null;

  if (!classification) {
    throw createError({ statusCode: 400, statusMessage: "Classification is required." });
  }

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);

    let result: { rowCount: number };
    try {
      result = await client.query(
        groupId
          ? `UPDATE asset_inventory SET asset_classification = $1, title = $2, description = $3, value = $4, location = $5 WHERE ai_id = $6 AND (user_id = $7 OR group_id = $8)`
          : `UPDATE asset_inventory SET asset_classification = $1, title = $2, description = $3, value = $4, location = $5 WHERE ai_id = $6 AND user_id = $7`,
        groupId
          ? [classification, title, description, value, location, id, userId, groupId]
          : [classification, title, description, value, location, id, userId],
      );
    } catch (schemaErr: unknown) {
      const msg = String((schemaErr as Error)?.message ?? "");
      if (msg.includes("does not exist") || msg.includes("column")) {
        result = await client.query(
          groupId
            ? `UPDATE asset_inventory SET asset_category = $1, classification_type = $2, title = $3, description = $4, value = $5, location = $6 WHERE ai_id = $7 AND (user_id = $8 OR group_id = $9)`
            : `UPDATE asset_inventory SET asset_category = $1, classification_type = $2, title = $3, description = $4, value = $5, location = $6 WHERE ai_id = $7 AND user_id = $8`,
          groupId
            ? ["Asset", classification, title, description, value, location, id, userId, groupId]
            : ["Asset", classification, title, description, value, location, id, userId],
        );
      } else {
        throw schemaErr;
      }
    }

    if (result.rowCount === 0) {
      throw createError({ statusCode: 404, statusMessage: "Record not found." });
    }
    return { success: true };
  } catch (e) {
    if (e?.statusCode) throw e;
    throw createError({ statusCode: 500, statusMessage: "Failed to update record." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
