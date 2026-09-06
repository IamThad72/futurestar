import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { getActiveBudget } from "../../utils/budgetAccess";
import {
  isTaxAnnualKind,
  listTaxAnnualTotals,
  upsertTaxAnnualTotal,
  type TaxAnnualKind,
} from "../../utils/taxAnnualTotals";

type TotalInput = {
  tax_kind?: string;
  total_amount?: number | string;
};

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const body = await readBody(event);
  const yearRaw = body?.year != null ? parseInt(String(body.year), 10) : new Date().getFullYear();
  const taxYear = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();
  const totals = Array.isArray(body?.totals) ? (body.totals as TotalInput[]) : [];

  if (!totals.length) {
    throw createError({ statusCode: 400, statusMessage: "Provide at least one total to update." });
  }

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const active = await getActiveBudget(client, userId, groupId);

    for (const row of totals) {
      const kind = String(row.tax_kind || "").trim().toLowerCase();
      const amount = Number(row.total_amount);

      if (!isTaxAnnualKind(kind)) {
        throw createError({ statusCode: 400, statusMessage: `Invalid tax kind: ${row.tax_kind}` });
      }
      if (!Number.isFinite(amount)) {
        throw createError({ statusCode: 400, statusMessage: `Invalid amount for ${kind}` });
      }

      await upsertTaxAnnualTotal(
        client,
        active.budget_id,
        userId,
        groupId,
        taxYear,
        kind as TaxAnnualKind,
        amount,
      );
    }

    const listed = await listTaxAnnualTotals(client, active.budget_id, taxYear);
    return {
      success: true,
      tax_year: taxYear,
      budget_id: active.budget_id,
      ...listed,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("tax annual totals update failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to update tax annual totals." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
