import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId } from "../../utils/group";
import { getActiveBudget } from "../../utils/budgetAccess";
import {
  refreshTaxAnnualTotalsForYear,
  TAX_ANNUAL_KIND_LABELS,
  TAX_ANNUAL_KINDS,
  type TaxAnnualKind,
} from "../../utils/taxAnnualTotals";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const query = getQuery(event);
  const yearRaw = query.year != null ? parseInt(String(query.year), 10) : new Date().getFullYear();
  const taxYear = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const active = await getActiveBudget(client, userId, groupId);

    // Read cached totals only. Recalc happens on tax transaction writes.
    // Optional ?refresh=1 forces a rebuild (admin/debug).
    if (String(query.refresh ?? "") === "1") {
      await refreshTaxAnnualTotalsForYear(client, active.budget_id, userId, groupId, taxYear);
    }

    const result = await client.query(
      `SELECT tax_kind, total_amount, updated_at
       FROM tax_annual_totals
       WHERE budget_id = $1 AND tax_year = $2`,
      [active.budget_id, taxYear],
    );

    const byKind = Object.fromEntries(
      result.rows.map((r) => [String(r.tax_kind), Number(r.total_amount) || 0]),
    ) as Record<string, number>;

    const totals = TAX_ANNUAL_KINDS.map((kind: TaxAnnualKind) => ({
      tax_kind: kind,
      label: TAX_ANNUAL_KIND_LABELS[kind],
      total_amount: byKind[kind] ?? 0,
    }));

    return {
      tax_year: taxYear,
      budget_id: active.budget_id,
      totals,
      grand_total: totals.reduce((sum, t) => sum + t.total_amount, 0),
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("tax annual totals failed", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to load tax annual totals." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
