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
  const policyHolder = String(body?.policy_holder ?? "").trim() || null;
  const polocyNumber = String(body?.polocy_number ?? "").trim() || null;
  const entityCovered = String(body?.entity_covered ?? "").trim() || null;
  const policyAmt = body?.policy_amt != null ? Number(body.policy_amt) : null;
  const intent = String(body?.intent ?? "").trim() || null;
  const institutionUrl = String(body?.institution_url ?? "").trim() || null;

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const params = groupId
      ? [policyHolder, polocyNumber, entityCovered, policyAmt, intent, institutionUrl, id, userId, groupId]
      : [policyHolder, polocyNumber, entityCovered, policyAmt, intent, institutionUrl, id, userId];

    const result = await client.query(
      groupId
        ? `UPDATE insurance SET policy_holder = $1, polocy_number = $2, entity_covered = $3, policy_amt = $4, intent = $5, institution_url = $6 WHERE ins_id = $7 AND (user_id = $8 OR group_id = $9)`
        : `UPDATE insurance SET policy_holder = $1, polocy_number = $2, entity_covered = $3, policy_amt = $4, intent = $5, institution_url = $6 WHERE ins_id = $7 AND user_id = $8`,
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
