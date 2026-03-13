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
  const institution = String(body?.institution ?? "").trim() || null;
  const acctNumber = String(body?.acct_number ?? "").trim() || null;
  const acctType = String(body?.acct_type ?? "").trim() || null;
  const value = body?.value != null ? Number(body.value) : null;
  const institutionUrl = String(body?.institution_url ?? "").trim() || null;
  const acctHolder = String(body?.acct_holder ?? "").trim() || null;
  const acctIntent = String(body?.acct_intent ?? "").trim() || null;
  const trustDesignated = body?.trust_designated === true || body?.trust_designated === "Y";
  const assetCategory = String(body?.asset_category ?? "").trim() || null;
  const acctSupportNumber = String(body?.acct_support_number ?? "").trim() || null;

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
      ? [institution, acctNumber, acctType, value, institutionUrl, acctHolder, acctIntent, trustDesignated, assetCategory, acctSupportNumber, id, userId, groupId]
      : [institution, acctNumber, acctType, value, institutionUrl, acctHolder, acctIntent, trustDesignated, assetCategory, acctSupportNumber, id, userId];

    const result = await client.query(
      groupId
        ? `UPDATE cash_and_investments SET institution = $1, acct_number = $2, acct_type = $3, value = $4, institution_url = $5, acct_holder = $6, acct_intent = $7, trust_designated = $8, asset_category = $9, acct_support_number = $10 WHERE ci_id = $11 AND (user_id = $12 OR group_id = $13)`
        : `UPDATE cash_and_investments SET institution = $1, acct_number = $2, acct_type = $3, value = $4, institution_url = $5, acct_holder = $6, acct_intent = $7, trust_designated = $8, asset_category = $9, acct_support_number = $10 WHERE ci_id = $11 AND user_id = $12`,
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
