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
  const policyHolder = String(body?.policy_holder ?? "").trim() || null;
  const polocyNumber = String(body?.polocy_number ?? "").trim() || null;
  const entityCovered = String(body?.entity_covered ?? "").trim() || null;
  const policyAmt = body?.policy_amt != null && body?.policy_amt !== "" ? Number(body.policy_amt) : null;
  const intent = String(body?.intent ?? "").trim() || null;
  const institutionUrl = String(body?.institution_url ?? "").trim() || null;

  if (!policyHolder) {
    throw createError({
      statusCode: 400,
      statusMessage: "Policy holder is required.",
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
      `INSERT INTO insurance
        (policy_holder, polocy_number, entity_covered, policy_amt, intent, institution_url, user_id, group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        policyHolder,
        polocyNumber,
        entityCovered,
        policyAmt,
        intent,
        institutionUrl,
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
      statusMessage: "Failed to submit insurance entry.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
