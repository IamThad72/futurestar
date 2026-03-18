import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const body = await readBody(event);
  const assetCategory = "Asset";
  const classificationType = String(body?.classification_type ?? "").trim();
  const title = String(body?.title ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const value = body?.value ?? null;
  const location = String(body?.location ?? "").trim();

  if (!assetCategory || !classificationType) {
    throw createError({
      statusCode: 400,
      statusMessage: "Asset category and classification are required.",
    });
  }

  if (assetCategory === "Asset") {
    if (!title || !description || value === null || value === "") {
      throw createError({
        statusCode: 400,
        statusMessage: "Title, description, and value are required for assets.",
      });
    }
  }

  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);

    if (assetCategory === "Asset") {
      await client.query(
        `INSERT INTO asset_inventory
          (user_id, group_id, asset_classification, title, description, value, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          groupId,
          classificationType,
          title || null,
          description || null,
          value || null,
          location || null,
        ],
      );
    }

    await client.query(
      `INSERT INTO estate_entries
        (user_id, group_id, asset_category, classification_type, title, description, value, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        groupId,
        assetCategory,
        classificationType,
        title || null,
        description || null,
        value || null,
        location || null,
      ],
    );

    return { success: true };
  } catch (error: any) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to submit estate entry.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
