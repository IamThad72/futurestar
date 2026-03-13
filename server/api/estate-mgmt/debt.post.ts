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
  const institution = String(body?.institution ?? "").trim() || null;
  const loanNumber = String(body?.loan_number ?? "").trim() || null;
  const loanType = String(body?.loan_type ?? "").trim() || null;
  const customerSupportNo = String(body?.customer_support_no ?? "").trim() || null;
  const addressUrl = String(body?.address_url ?? "").trim() || null;
  const borrower = String(body?.borrower ?? "").trim() || null;
  const loanAmmount = body?.loan_ammount != null && body?.loan_ammount !== "" ? body.loan_ammount : null;
  const linkedAssetType = String(body?.linked_asset_type ?? "").trim() || null;
  const linkedAssetId = body?.linked_asset_id != null && body?.linked_asset_id !== "" ? Number(body.linked_asset_id) : null;

  if (!institution) {
    throw createError({
      statusCode: 400,
      statusMessage: "Institution is required.",
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
      `INSERT INTO debt
        (institution, loan_number, loan_type, customer_support_no, address_url, borrower, loan_ammount, linked_asset_type, linked_asset_id, user_id, group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        institution,
        loanNumber,
        loanType,
        customerSupportNo,
        addressUrl,
        borrower,
        loanAmmount,
        linkedAssetType,
        linkedAssetId,
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
      statusMessage: "Failed to submit debt entry.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
