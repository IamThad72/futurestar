import {
  FISCAL_POSTTAX_KIND_LABELS as POSTTAX_KIND_LABELS,
  FISCAL_POSTTAX_KINDS as POSTTAX_KINDS,
  FISCAL_PRETAX_KIND_LABELS as PRETAX_KIND_LABELS,
  FISCAL_PRETAX_KINDS as PRETAX_KINDS,
  classifyFiscalIncomeKind,
  classifyFiscalPosttaxKind,
  classifyFiscalPretaxKind,
  wageBases,
} from "~/utils/tax/deductions.js";
import { annualTotalsHouseholdKey } from "./taxAnnualTotals";

export { classifyFiscalIncomeKind, classifyFiscalPosttaxKind, classifyFiscalPretaxKind };

export const FISCAL_INCOME_KINDS = ["gross", "net", "taxable"] as const;
export const FISCAL_PRETAX_KINDS = PRETAX_KINDS;
export const FISCAL_POSTTAX_KINDS = POSTTAX_KINDS;

export type FiscalIncomeKind = (typeof FISCAL_INCOME_KINDS)[number];
export type FiscalPretaxKind = string;
export type FiscalPosttaxKind = string;
export type FiscalSection = "income" | "pretax" | "posttax";
export type FiscalTotalKind = FiscalIncomeKind | FiscalPretaxKind | FiscalPosttaxKind;

export const FISCAL_INCOME_KIND_LABELS: Record<FiscalIncomeKind, string> = {
  gross: "Gross Income",
  net: "Net Income",
  taxable: "Taxable Income",
};

export const FISCAL_PRETAX_KIND_LABELS: Record<string, string> = PRETAX_KIND_LABELS;
export const FISCAL_POSTTAX_KIND_LABELS: Record<string, string> = POSTTAX_KIND_LABELS;

type DbClient = {
  query: (queryText: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
};

export function isFiscalIncomeKind(kind: string): kind is FiscalIncomeKind {
  return (FISCAL_INCOME_KINDS as readonly string[]).includes(kind);
}

export function isFiscalPretaxKind(kind: string): kind is FiscalPretaxKind {
  return (FISCAL_PRETAX_KINDS as readonly string[]).includes(kind);
}

export function isFiscalPosttaxKind(kind: string): kind is FiscalPosttaxKind {
  return (FISCAL_POSTTAX_KINDS as readonly string[]).includes(kind);
}

type DeductionOverride = {
  category?: string | null;
  sub_category?: string | null;
  deduction_key?: string | null;
};

/** Household line overrides. A missing table leaves keyword classification in place. */
export async function listDeductionOverrides(
  client: DbClient,
  userId: number,
  groupId: number | null,
): Promise<DeductionOverride[]> {
  const found = await client.query(`SELECT to_regclass('public.tax_deduction_overrides') AS rel`);
  if (!found.rows[0]?.rel) return [];
  const result = await client.query(
    `SELECT category, sub_category, deduction_key
     FROM tax_deduction_overrides
     WHERE household_key = $1`,
    [annualTotalsHouseholdKey(userId, groupId)],
  );
  return result.rows;
}

/** Taxable income when every pre-tax dollar reduces federal wages. Box 1 uses the deduction file. */
export function computeTaxableIncome(grossAmount: number, pretaxSum: number) {
  const gross = Number(grossAmount) || 0;
  const pretax = Number(pretaxSum) || 0;
  return Math.max(0, Math.round((gross - pretax) * 100) / 100);
}

export function sumFiscalPretaxAmounts(
  pretax: Array<{ total_kind?: string; total_amount?: number | string | null }>,
) {
  return FISCAL_PRETAX_KINDS.reduce((sum, kind) => {
    const row = pretax.find((r) => r.total_kind === kind);
    return sum + (Number(row?.total_amount) || 0);
  }, 0);
}

/** Persist Taxable Income from stored Gross and the five Pre-Tax kinds. */
export async function syncTaxableIncomeFromGrossAndPretax(
  client: DbClient,
  userId: number,
  groupId: number | null,
  taxYear: number | null | undefined,
) {
  const year = taxYear == null ? NaN : Number(taxYear);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return;

  const { income, pretax } = await listFiscalAnnualTotals(client, userId, groupId, year);
  const gross = income.find((r) => r.total_kind === "gross")?.total_amount ?? 0;
  const deductions = Object.fromEntries(pretax.map((row) => [row.total_kind, row.total_amount]));
  const taxable = wageBases({ gross, deductions }).box1;
  await upsertFiscalAnnualTotal(client, userId, groupId, year, "income", "taxable", taxable);
}

/**
 * Apply Income / Pre-Tax / Post-Tax deltas for a new or changed transaction.
 * Gross and Net only add/subtract this amount onto the stored baseline — never
 * rebuilt from summing income rows. Tax withholdings stay in tax_annual_totals.
 */
export async function applyFiscalTotalsForTransaction(
  client: DbClient,
  userId: number,
  groupId: number | null,
  taxYear: number | null | undefined,
  input: {
    itemKind: "income" | "expense";
    itemType: string | null | undefined;
    category: string | null | undefined;
    subCategory: string | null | undefined;
    signedAmount: number;
  },
) {
  const year = taxYear == null ? NaN : Number(taxYear);
  const amount = Number(input.signedAmount);
  if (!Number.isFinite(year) || !Number.isFinite(amount) || amount === 0) return;

  const itemType = String(input.itemType || "").trim().toLowerCase();
  let syncTaxable = false;
  const overrides = await listDeductionOverrides(client, userId, groupId);

  if (input.itemKind === "income") {
    if (itemType === "deduction") {
      // Post-Tax first so Supplemental Life never lands in Pre-Tax.
      const posttaxKind = classifyFiscalPosttaxKind(input.category, input.subCategory, overrides);
      if (posttaxKind) {
        await applyFiscalAnnualTotalDelta(
          client,
          userId,
          groupId,
          year,
          "posttax",
          posttaxKind,
          amount,
        );
      } else {
        const pretaxKind = classifyFiscalPretaxKind(input.category, input.subCategory, overrides);
        if (pretaxKind) {
          await applyFiscalAnnualTotalDelta(
            client,
            userId,
            groupId,
            year,
            "pretax",
            pretaxKind,
            amount,
          );
          syncTaxable = true;
        }
      }
    } else if (itemType === "gross" || itemType === "interest" || itemType === "other" || !itemType) {
      const incomeKind = classifyFiscalIncomeKind(input.category, input.subCategory);
      if (incomeKind) {
        await applyFiscalAnnualTotalDelta(
          client,
          userId,
          groupId,
          year,
          "income",
          incomeKind,
          amount,
        );
        if (incomeKind === "gross") syncTaxable = true;
      }
    }
  } else if (itemType === "savings" || itemType === "investment") {
    const pretaxKind = classifyFiscalPretaxKind(input.category, input.subCategory, overrides);
    if (pretaxKind) {
      await applyFiscalAnnualTotalDelta(
        client,
        userId,
        groupId,
        year,
        "pretax",
        pretaxKind,
        amount,
      );
      syncTaxable = true;
    }
  }

  if (syncTaxable) {
    await syncTaxableIncomeFromGrossAndPretax(client, userId, groupId, year);
  }
}

export async function upsertFiscalAnnualTotal(
  client: DbClient,
  userId: number,
  groupId: number | null,
  taxYear: number,
  section: FiscalSection,
  totalKind: FiscalTotalKind,
  totalAmount: number,
) {
  await client.query(
    `INSERT INTO fiscal_annual_totals (user_id, group_id, household_key, tax_year, section, total_kind, total_amount, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (household_key, tax_year, section, total_kind)
     DO UPDATE SET
       total_amount = EXCLUDED.total_amount,
       user_id = EXCLUDED.user_id,
       group_id = EXCLUDED.group_id,
       updated_at = NOW()`,
    [userId, groupId, annualTotalsHouseholdKey(userId, groupId), taxYear, section, totalKind, totalAmount],
  );
}

export async function applyFiscalAnnualTotalDelta(
  client: DbClient,
  userId: number,
  groupId: number | null,
  taxYear: number,
  section: FiscalSection,
  totalKind: FiscalTotalKind,
  deltaAmount: number,
) {
  const delta = Number(deltaAmount);
  if (!Number.isFinite(delta) || delta === 0) return;

  await client.query(
    `INSERT INTO fiscal_annual_totals (user_id, group_id, household_key, tax_year, section, total_kind, total_amount, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (household_key, tax_year, section, total_kind)
     DO UPDATE SET
       total_amount = GREATEST(0, fiscal_annual_totals.total_amount + EXCLUDED.total_amount),
       user_id = EXCLUDED.user_id,
       group_id = EXCLUDED.group_id,
       updated_at = NOW()`,
    [userId, groupId, annualTotalsHouseholdKey(userId, groupId), taxYear, section, totalKind, delta],
  );
}

function assembleFiscalAnnualTotals(byKey: Map<string, number>) {
  const gross = byKey.get("income:gross") ?? 0;

  const pretax = FISCAL_PRETAX_KINDS.map((kind) => ({
    section: "pretax" as const,
    total_kind: kind,
    label: FISCAL_PRETAX_KIND_LABELS[kind],
    total_amount: byKey.get(`pretax:${kind}`) ?? 0,
  }));

  const taxable = wageBases({
    gross,
    deductions: Object.fromEntries(pretax.map((row) => [row.total_kind, row.total_amount])),
  }).box1;

  const income = FISCAL_INCOME_KINDS.map((kind) => ({
    section: "income" as const,
    total_kind: kind,
    label: FISCAL_INCOME_KIND_LABELS[kind],
    total_amount:
      kind === "taxable" ? taxable : kind === "gross" ? gross : (byKey.get(`income:${kind}`) ?? 0),
  }));

  const posttax = FISCAL_POSTTAX_KINDS.map((kind) => ({
    section: "posttax" as const,
    total_kind: kind,
    label: FISCAL_POSTTAX_KIND_LABELS[kind],
    total_amount: byKey.get(`posttax:${kind}`) ?? 0,
  }));

  return { income, pretax, posttax };
}

export async function listFiscalAnnualTotals(
  client: DbClient,
  userId: number,
  groupId: number | null,
  taxYear: number,
) {
  const householdKey = annualTotalsHouseholdKey(userId, groupId);
  const result = await client.query(
    `SELECT section, total_kind, total_amount
     FROM fiscal_annual_totals
     WHERE household_key = $1 AND tax_year = $2`,
    [householdKey, taxYear],
  );

  const byKey = new Map<string, number>();
  for (const row of result.rows) {
    byKey.set(`${row.section}:${row.total_kind}`, Number(row.total_amount) || 0);
  }

  return assembleFiscalAnnualTotals(byKey);
}
