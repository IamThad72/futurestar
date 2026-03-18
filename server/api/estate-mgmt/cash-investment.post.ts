import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const body = await readBody(event);
  const assetCategory = String(body?.asset_category ?? "").trim();
  const classificationType = String(body?.classification_type ?? "").trim();
  const institution = String(body?.institution ?? "").trim();
  const accountNumber = String(body?.account_number ?? "").trim();
  const value = body?.value ?? null;
  const accountSupportNumber = String(body?.account_support_number ?? "").trim();
  const institutionUrl = String(body?.institution_url ?? "").trim();
  const accountHolder = String(body?.account_holder ?? "").trim();
  const accountIntent = String(body?.account_intent ?? "").trim();
  const trustDesignated = String(body?.trust_designated ?? "").trim().toUpperCase();

  if (
    !assetCategory ||
    !classificationType ||
    !institution ||
    !accountNumber ||
    value === null ||
    value === "" ||
    !accountSupportNumber ||
    !institutionUrl ||
    !accountHolder ||
    !accountIntent ||
    (trustDesignated !== "Y" && trustDesignated !== "N")
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Classification, institution, account number, value, support number, URL, holder, intent, and trust designated are required.",
    });
  }

  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);

    await client.query(
      `INSERT INTO cash_and_investments
        (asset_category, acct_type, institution, acct_number, value, acct_support_number, institution_url, acct_holder, acct_intent, trust_designated, user_id, group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        assetCategory,
        classificationType,
        institution,
        accountNumber,
        value,
        accountSupportNumber,
        institutionUrl,
        accountHolder,
        accountIntent,
        trustDesignated === "Y",
        userId,
        groupId,
      ],
    );

    await client.query(
      `INSERT INTO estate_entries
        (user_id, group_id, asset_category, classification_type, title, description, value, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, groupId, assetCategory, classificationType, institution, accountIntent, value, institutionUrl],
    );

    return { success: true };
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    console.error("cash-investment submit failed", error);
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "Failed to submit cash or investment entry.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
