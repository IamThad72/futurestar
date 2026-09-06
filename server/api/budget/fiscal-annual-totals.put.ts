import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { getActiveBudget } from "../../utils/budgetAccess";
import {
  isFiscalIncomeKind,
  isFiscalPosttaxKind,
  isFiscalPretaxKind,
  listFiscalAnnualTotals,
  syncTaxableIncomeFromGrossAndPretax,
  upsertFiscalAnnualTotal,
  type FiscalSection,
  type FiscalTotalKind,
} from "../../utils/fiscalAnnualTotals";

type TotalInput = {
  section?: string;
  total_kind?: string;
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
      const section = String(row.section || "").trim().toLowerCase() as FiscalSection;
      const kind = String(row.total_kind || "").trim().toLowerCase();
      const amount = Number(row.total_amount);

      if (section !== "income" && section !== "pretax" && section !== "posttax") {
        throw createError({ statusCode: 400, statusMessage: `Invalid section: ${row.section}` });
      }
      if (section === "income" && kind === "taxable") {
        // Taxable is always Gross − Pre-Tax; ignore a client override.
        continue;
      }
      if (section === "income" && !isFiscalIncomeKind(kind)) {
        throw createError({ statusCode: 400, statusMessage: `Invalid income kind: ${row.total_kind}` });
      }
      if (section === "pretax" && !isFiscalPretaxKind(kind)) {
        throw createError({ statusCode: 400, statusMessage: `Invalid pretax kind: ${row.total_kind}` });
      }
      if (section === "posttax" && !isFiscalPosttaxKind(kind)) {
        throw createError({ statusCode: 400, statusMessage: `Invalid posttax kind: ${row.total_kind}` });
      }
      if (!Number.isFinite(amount)) {
        throw createError({ statusCode: 400, statusMessage: `Invalid amount for ${section}/${kind}` });
      }

      await upsertFiscalAnnualTotal(
        client,
        active.budget_id,
        userId,
        groupId,
        taxYear,
        section,
        kind as FiscalTotalKind,
        amount,
      );
    }

    await syncTaxableIncomeFromGrossAndPretax(
      client,
      active.budget_id,
      userId,
      groupId,
      taxYear,
    );

    const listed = await listFiscalAnnualTotals(client, active.budget_id, taxYear);
    return {
      success: true,
      tax_year: taxYear,
      budget_id: active.budget_id,
      ...listed,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("fiscal annual totals update failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to update fiscal annual totals." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
