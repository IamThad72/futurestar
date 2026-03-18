import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const body = await readBody(event);
  const classificationType = String(body?.classification_type ?? "").trim();
  const year = body?.year ?? null;
  const make = String(body?.make ?? "").trim();
  const model = String(body?.model ?? "").trim();
  const vin = String(body?.vin ?? "").trim();
  const value = body?.value ?? null;
  const age = body?.age ?? null;
  const description = String(body?.description ?? "").trim();
  const trustDesignated = String(body?.trust_designated ?? "").trim().toUpperCase();

  if (
    !classificationType ||
    !year ||
    !make ||
    !model ||
    value === null ||
    value === "" ||
    !age ||
    !description ||
    (trustDesignated !== "Y" && trustDesignated !== "N")
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Year, make, model, value, age, description, and trust designated are required.",
    });
  }

  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);

    if (vin) {
      const existingVin = await client.query(
        `SELECT 1 FROM asset_vehicles WHERE vin IS NOT NULL AND TRIM(LOWER(vin)) = TRIM(LOWER($1)) LIMIT 1`,
        [vin],
      );
      if (existingVin.rows.length > 0) {
        throw createError({
          statusCode: 409,
          statusMessage:
            "This vehicle already exists in the database. Please try again.",
        });
      }
    }

    await client.query(
      `INSERT INTO asset_vehicles
        (year, make, model, vin, value, age, description, trust_designated, user_id, group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        year,
        make,
        model,
        vin || null,
        value,
        age,
        description,
        trustDesignated === "Y",
        userId,
        groupId,
      ],
    );

    await client.query(
      `INSERT INTO estate_entries
        (user_id, group_id, asset_category, classification_type, title, description, value, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        groupId,
        "Vehicle",
        classificationType,
        `${make} ${model}`.trim() || null,
        description || null,
        value || null,
        vin || null,
      ],
    );

    return { success: true };
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to submit vehicle entry.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
