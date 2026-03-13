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
  const loanNumber = String(body?.loan_number ?? "").trim() || null;
  const loanType = String(body?.loan_type ?? "").trim() || null;
  const customerSupportNo = String(body?.customer_support_no ?? "").trim() || null;
  const addressUrl = String(body?.address_url ?? "").trim() || null;
  const borrower = String(body?.borrower ?? "").trim() || null;
  const rawLoanAmt = body?.loan_ammount;
  const loanAmmount = rawLoanAmt != null && rawLoanAmt !== ""
    ? (typeof rawLoanAmt === "number" ? rawLoanAmt : parseFloat(String(rawLoanAmt).replace(/[$,]/g, "")) || null)
    : null;
  const linkedAssetType = String(body?.linked_asset_type ?? "").trim() || null;
  const linkedAssetId = body?.linked_asset_id != null && body?.linked_asset_id !== "" ? Number(body.linked_asset_id) : null;

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
      ? [institution, loanNumber, loanType, customerSupportNo, addressUrl, borrower, loanAmmount, linkedAssetType, linkedAssetId, id, userId, groupId]
      : [institution, loanNumber, loanType, customerSupportNo, addressUrl, borrower, loanAmmount, linkedAssetType, linkedAssetId, id, userId];

    const result = await client.query(
      groupId
        ? `UPDATE debt SET institution = $1, loan_number = $2, loan_type = $3, customer_support_no = $4, address_url = $5, borrower = $6, loan_ammount = $7, linked_asset_type = $8, linked_asset_id = $9 WHERE dbt_id = $10 AND (user_id = $11 OR group_id = $12)`
        : `UPDATE debt SET institution = $1, loan_number = $2, loan_type = $3, customer_support_no = $4, address_url = $5, borrower = $6, loan_ammount = $7, linked_asset_type = $8, linked_asset_id = $9 WHERE dbt_id = $10 AND user_id = $11`,
      params,
    );

    if (result.rowCount === 0) throw createError({ statusCode: 404, statusMessage: "Record not found." });
    return { success: true };
  } catch (e) {
    if (e?.statusCode) throw e;
    const msg = (e as Error)?.message ?? "Failed to update record.";
    throw createError({ statusCode: 500, statusMessage: msg });
  } finally {
    await client.end().catch(() => undefined);
  }
});
