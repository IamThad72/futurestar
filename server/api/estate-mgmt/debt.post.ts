import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { parseOptionalBoolean, parseOptionalDate, parseOptionalInt, parseOptionalNumber } from "../../utils/debtFields";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

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
  const isRevolving = parseOptionalBoolean(body?.is_revolving);
  const interestRateAnnual = parseOptionalNumber(body?.interest_rate_annual);
  const termMonths = parseOptionalInt(body?.term_months);
  const scheduledMonthlyPayment = parseOptionalNumber(body?.scheduled_monthly_payment);
  const loanStartDate = parseOptionalDate(body?.loan_start_date);

  if (!institution) {
    throw createError({
      statusCode: 400,
      statusMessage: "Institution is required.",
    });
  }

  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);

    await client.query(
      `INSERT INTO debt
        (institution, loan_number, loan_type, customer_support_no, address_url, borrower, loan_ammount, linked_asset_type, linked_asset_id, user_id, group_id, is_revolving, interest_rate_annual, term_months, scheduled_monthly_payment, loan_start_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, TRUE), $13, $14, $15, $16::date)`,
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
        isRevolving,
        interestRateAnnual,
        termMonths,
        scheduledMonthlyPayment,
        loanStartDate,
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
