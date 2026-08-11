export const FISCAL_INCOME_KINDS = ["gross", "net", "taxable"] as const;
export const FISCAL_PRETAX_KINDS = ["medical", "dental", "vision", "401k", "hsa"] as const;
export const FISCAL_POSTTAX_KINDS = ["supplemental_life", "stock_option_offset"] as const;

export type FiscalIncomeKind = (typeof FISCAL_INCOME_KINDS)[number];
export type FiscalPretaxKind = (typeof FISCAL_PRETAX_KINDS)[number];
export type FiscalPosttaxKind = (typeof FISCAL_POSTTAX_KINDS)[number];
export type FiscalSection = "income" | "pretax" | "posttax";
export type FiscalTotalKind = FiscalIncomeKind | FiscalPretaxKind | FiscalPosttaxKind;

export const FISCAL_INCOME_KIND_LABELS: Record<FiscalIncomeKind, string> = {
  gross: "Gross Income",
  net: "Net Income",
  taxable: "Taxable Income",
};

export const FISCAL_PRETAX_KIND_LABELS: Record<FiscalPretaxKind, string> = {
  medical: "Medical Insurance",
  dental: "Dental Insurance",
  vision: "Vision Insurance",
  "401k": "401K",
  hsa: "HSA",
};

export const FISCAL_POSTTAX_KIND_LABELS: Record<FiscalPosttaxKind, string> = {
  supplemental_life: "Supplemental Life",
  stock_option_offset: "Stock Option Offset",
};

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

function labelBlob(
  category: string | null | undefined,
  subCategory: string | null | undefined = null,
) {
  return `${category || ""} ${subCategory || ""}`.trim().toLowerCase();
}

function looksLikeNetIncome(
  category: string | null | undefined,
  subCategory: string | null | undefined = null,
) {
  const cat = String(category || "")
    .trim()
    .toLowerCase();
  const sub = String(subCategory || "")
    .trim()
    .toLowerCase();
  if (
    /\bnet\s+income\b/.test(sub) ||
    /\bnet\s+pay\b/.test(sub) ||
    sub === "net" ||
    sub.includes("take home") ||
    sub.includes("take-home")
  ) {
    return true;
  }
  return /\bnet\s+income\b/.test(cat) || /\bnet\s+pay\b/.test(cat);
}

function looksLikeGrossIncome(
  category: string | null | undefined,
  subCategory: string | null | undefined = null,
) {
  if (looksLikeNetIncome(category, subCategory)) return false;
  const cat = String(category || "")
    .trim()
    .toLowerCase();
  const sub = String(subCategory || "")
    .trim()
    .toLowerCase();
  const looksGross = (t: string) =>
    t === "gross" ||
    t.includes("gross income") ||
    t.includes("gross pay") ||
    t.includes("gross salary") ||
    t.includes("gross wages");
  if (looksGross(cat) || looksGross(sub)) return true;
  if (/payroll/i.test(String(category || "").trim())) return true;
  return false;
}

/** Map budget line labels to Gross / Net income totals. */
export function classifyFiscalIncomeKind(
  category: string | null | undefined,
  subCategory: string | null | undefined = null,
): "gross" | "net" | null {
  if (looksLikeNetIncome(category, subCategory)) return "net";
  if (looksLikeGrossIncome(category, subCategory)) return "gross";
  return null;
}

/** Map budget line category/subcategory text to a Pre-Tax annual total kind. */
export function classifyFiscalPretaxKind(
  category: string | null | undefined,
  subCategory: string | null | undefined = null,
): FiscalPretaxKind | null {
  const blob = labelBlob(category, subCategory);
  if (!blob) return null;
  if (/dental/.test(blob)) return "dental";
  if (/vision/.test(blob)) return "vision";
  if (/\bhsa\b|health\s*savings/.test(blob)) return "hsa";
  if (/\b401\s*[\(\s-]*k\b/.test(blob)) return "401k";
  if (/medical|family\s*(health\s*)?insurance|health\s*insurance/.test(blob)) {
    return "medical";
  }
  return null;
}

/** Map budget line labels to Post-Tax annual total kinds. */
export function classifyFiscalPosttaxKind(
  category: string | null | undefined,
  subCategory: string | null | undefined = null,
): FiscalPosttaxKind | null {
  const blob = labelBlob(category, subCategory);
  if (!blob) return null;
  if (
    /supplemental\s*life/.test(blob) ||
    /supp\.?\s*life/.test(blob) ||
    /voluntary\s*life/.test(blob)
  ) {
    return "supplemental_life";
  }
  if (/stock\s*option\s*offset|stock\s*option|rsu\s*offset|option\s*offset/.test(blob)) {
    return "stock_option_offset";
  }
  return null;
}

/** Taxable Income = Gross Income − Pre-Tax total for the year. */
export async function syncTaxableIncomeFromGrossAndPretax(
  client: DbClient,
  budgetId: number,
  userId: number,
  groupId: number | null,
  taxYear: number | null | undefined,
) {
  const year = taxYear == null ? NaN : Number(taxYear);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return;

  const { income, pretax } = await listFiscalAnnualTotals(client, budgetId, year);
  const gross = income.find((r) => r.total_kind === "gross")?.total_amount ?? 0;
  const pretaxSum = pretax.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);
  const taxable = Math.max(0, Math.round((gross - pretaxSum) * 100) / 100);
  await upsertFiscalAnnualTotal(
    client,
    budgetId,
    userId,
    groupId,
    year,
    "income",
    "taxable",
    taxable,
  );
}

/**
 * Apply Income / Pre-Tax / Post-Tax deltas for a new or changed transaction.
 * Tax withholdings stay in tax_annual_totals (handled separately).
 */
export async function applyFiscalTotalsForTransaction(
  client: DbClient,
  budgetId: number,
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

  if (input.itemKind === "income") {
    if (itemType === "deduction") {
      // Post-Tax first so Supplemental Life never lands in Pre-Tax.
      const posttaxKind = classifyFiscalPosttaxKind(input.category, input.subCategory);
      if (posttaxKind) {
        await applyFiscalAnnualTotalDelta(
          client,
          budgetId,
          userId,
          groupId,
          year,
          "posttax",
          posttaxKind,
          amount,
        );
      } else {
        const pretaxKind = classifyFiscalPretaxKind(input.category, input.subCategory);
        if (pretaxKind) {
          await applyFiscalAnnualTotalDelta(
            client,
            budgetId,
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
          budgetId,
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
    const pretaxKind = classifyFiscalPretaxKind(input.category, input.subCategory);
    if (pretaxKind) {
      await applyFiscalAnnualTotalDelta(
        client,
        budgetId,
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
    await syncTaxableIncomeFromGrossAndPretax(client, budgetId, userId, groupId, year);
  }
}

export async function upsertFiscalAnnualTotal(
  client: DbClient,
  budgetId: number,
  userId: number,
  groupId: number | null,
  taxYear: number,
  section: FiscalSection,
  totalKind: FiscalTotalKind,
  totalAmount: number,
) {
  await client.query(
    `INSERT INTO fiscal_annual_totals (budget_id, user_id, group_id, tax_year, section, total_kind, total_amount, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (budget_id, tax_year, section, total_kind)
     DO UPDATE SET
       total_amount = EXCLUDED.total_amount,
       user_id = EXCLUDED.user_id,
       group_id = EXCLUDED.group_id,
       updated_at = NOW()`,
    [budgetId, userId, groupId, taxYear, section, totalKind, totalAmount],
  );
}

export async function applyFiscalAnnualTotalDelta(
  client: DbClient,
  budgetId: number,
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
    `INSERT INTO fiscal_annual_totals (budget_id, user_id, group_id, tax_year, section, total_kind, total_amount, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (budget_id, tax_year, section, total_kind)
     DO UPDATE SET
       total_amount = GREATEST(0, fiscal_annual_totals.total_amount + EXCLUDED.total_amount),
       user_id = EXCLUDED.user_id,
       group_id = EXCLUDED.group_id,
       updated_at = NOW()`,
    [budgetId, userId, groupId, taxYear, section, totalKind, delta],
  );
}

export async function listFiscalAnnualTotals(
  client: DbClient,
  budgetId: number,
  taxYear: number,
) {
  const result = await client.query(
    `SELECT section, total_kind, total_amount, updated_at
     FROM fiscal_annual_totals
     WHERE budget_id = $1 AND tax_year = $2`,
    [budgetId, taxYear],
  );

  const byKey = new Map<string, number>();
  for (const row of result.rows) {
    byKey.set(`${row.section}:${row.total_kind}`, Number(row.total_amount) || 0);
  }

  const income = FISCAL_INCOME_KINDS.map((kind) => ({
    section: "income" as const,
    total_kind: kind,
    label: FISCAL_INCOME_KIND_LABELS[kind],
    total_amount: byKey.get(`income:${kind}`) ?? 0,
  }));

  const pretax = FISCAL_PRETAX_KINDS.map((kind) => ({
    section: "pretax" as const,
    total_kind: kind,
    label: FISCAL_PRETAX_KIND_LABELS[kind],
    total_amount: byKey.get(`pretax:${kind}`) ?? 0,
  }));

  const posttax = FISCAL_POSTTAX_KINDS.map((kind) => ({
    section: "posttax" as const,
    total_kind: kind,
    label: FISCAL_POSTTAX_KIND_LABELS[kind],
    total_amount: byKey.get(`posttax:${kind}`) ?? 0,
  }));

  return { income, pretax, posttax };
}
