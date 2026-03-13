import { createError, getCookie, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getUserGroupId } from "../../utils/group";
import { SESSION_COOKIE_NAME } from "../../utils/session";

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    throw createError({
      statusCode: 401,
      statusMessage: "You must be logged in to submit.",
    });
  }

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
    const sessionResult = await client.query(
      `SELECT user_id
       FROM app_sessions
       WHERE session_token = $1 AND expires_at > NOW()`,
      [sessionToken],
    );

    const userId = sessionResult.rows[0]?.user_id;

    if (!userId) {
      throw createError({
        statusCode: 401,
        statusMessage: "Session expired. Please log in again.",
      });
    }

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
