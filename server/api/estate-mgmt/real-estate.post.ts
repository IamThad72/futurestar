import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const body = await readBody(event);
  const number = String(body?.number ?? "").trim() || null;
  const street = String(body?.street ?? "").trim();
  const city = String(body?.city ?? "").trim();
  const state = String(body?.state ?? "").trim();
  const zipcode = String(body?.zipcode ?? "").trim();
  const value = body?.value != null ? Number(body.value) : null;
  const trustDesignated = String(body?.trust_designated ?? "").trim().toUpperCase();

  if (!street || !city || !state || !zipcode || value === null || value === "" || (trustDesignated !== "Y" && trustDesignated !== "N")) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Street, city, state, zipcode, value, and trust designated are required.",
    });
  }

  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);

    await client.query(
      `INSERT INTO real_estate
        (number, street, city, state, zipcode, value, trust_designated, user_id, group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        number,
        street,
        city,
        state,
        zipcode,
        value,
        trustDesignated === "Y",
        userId,
        groupId,
      ],
    );

    return { success: true };
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to submit real estate entry.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
