export const TAX_ANNUAL_KINDS = [
  "federal",
  "local",
  "medicare",
  "social_security",
  "state",
] as const;

export type TaxAnnualKind = (typeof TAX_ANNUAL_KINDS)[number];

export const TAX_ANNUAL_KIND_LABELS: Record<TaxAnnualKind, string> = {
  federal: "Federal",
  local: "Local",
  medicare: "Medicare",
  social_security: "Social Security",
  state: "State",
};

type DbClient = {
  query: (queryText: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
};

export function isTaxAnnualKind(kind: string): kind is TaxAnnualKind {
  return (TAX_ANNUAL_KINDS as readonly string[]).includes(kind);
}

/** Map tax income category/subcategory text to a standard annual total kind. */
export function classifyTaxAnnualKind(
  category: string | null | undefined,
  subCategory: string | null | undefined = null,
): TaxAnnualKind | null {
  const blob = `${category || ""} ${subCategory || ""}`.trim().toLowerCase();
  if (!blob) return null;
  if (/social\s*security|fica|\boasdi\b/.test(blob)) return "social_security";
  if (/medicare/.test(blob)) return "medicare";
  if (/federal|\bfed\b/.test(blob)) return "federal";
  if (/local|city|county|municipal/.test(blob)) return "local";
  if (/state/.test(blob)) return "state";
  return null;
}

export async function upsertTaxAnnualTotal(
  client: DbClient,
  budgetId: number,
  userId: number,
  groupId: number | null,
  taxYear: number,
  taxKind: TaxAnnualKind,
  totalAmount: number,
) {
  const amount = Number(totalAmount);
  if (!Number.isFinite(amount)) return;
  await client.query(
    `INSERT INTO tax_annual_totals (budget_id, user_id, group_id, tax_year, tax_kind, total_amount, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (budget_id, tax_year, tax_kind)
     DO UPDATE SET
       total_amount = EXCLUDED.total_amount,
       user_id = EXCLUDED.user_id,
       group_id = EXCLUDED.group_id,
       updated_at = NOW()`,
    [budgetId, userId, groupId, taxYear, taxKind, amount],
  );
}

export async function listTaxAnnualTotals(
  client: DbClient,
  budgetId: number,
  taxYear: number,
) {
  const result = await client.query(
    `SELECT tax_kind, total_amount, updated_at
     FROM tax_annual_totals
     WHERE budget_id = $1 AND tax_year = $2`,
    [budgetId, taxYear],
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
    totals,
    grand_total: totals.reduce((sum, t) => sum + t.total_amount, 0),
  };
}

/**
 * Fill in missing tax_annual_totals rows from tax transactions.
 * Never overwrites an existing stored amount — YTD is a manual baseline
 * plus paycheck deltas, not a rebuild from txs (which would wipe history).
 */
export async function refreshTaxAnnualTotalsForYear(
  client: DbClient,
  budgetId: number,
  userId: number,
  groupId: number | null,
  taxYear: number,
) {
  // Match tax txs to this budget's tax lines by classification (type/category/sub),
  // not by stored income_id (txs are date+classification owned, not budget-owned).
  const ownerFilter = groupId
    ? `(t.user_id = $3 OR t.group_id = $4 OR t.user_id IN (SELECT user_id FROM group_members WHERE group_id = $4))`
    : `t.user_id = $3`;
  const params = groupId ? [budgetId, taxYear, userId, groupId] : [budgetId, taxYear, userId];
  const summed = await client.query(
    `SELECT
       CASE
         WHEN lower(coalesce(i.income_category, '') || ' ' || coalesce(i.sub_category, '')) ~ 'social\\s*security|fica|\\boasdi\\b' THEN 'social_security'
         WHEN lower(coalesce(i.income_category, '') || ' ' || coalesce(i.sub_category, '')) ~ 'medicare' THEN 'medicare'
         WHEN lower(coalesce(i.income_category, '') || ' ' || coalesce(i.sub_category, '')) ~ 'federal|\\bfed\\b' THEN 'federal'
         WHEN lower(coalesce(i.income_category, '') || ' ' || coalesce(i.sub_category, '')) ~ 'local|city|county|municipal' THEN 'local'
         WHEN lower(coalesce(i.income_category, '') || ' ' || coalesce(i.sub_category, '')) ~ 'state' THEN 'state'
         ELSE NULL
       END AS tax_kind,
       COALESCE(SUM(ABS(COALESCE(t.amount, 0))), 0) AS total_amount
     FROM budget_transactions t
     JOIN income i
       ON i.budget_id = $1
      AND COALESCE(i.income_type, 'gross') = 'tax'
      AND lower(trim(COALESCE(t.item_type, ''))) = lower(trim(COALESCE(i.income_type, 'gross')))
      AND lower(trim(COALESCE(t.category, ''))) = lower(trim(i.income_category))
      AND lower(trim(COALESCE(t.sub_category, ''))) = lower(trim(COALESCE(i.sub_category, '')))
     WHERE COALESCE(t.item_kind, 'income') = 'income'
       AND EXTRACT(YEAR FROM t.transaction_date) = $2
       AND ${ownerFilter}
     GROUP BY 1`,
    params,
  );

  const byKind = new Map<string, number>();
  for (const row of summed.rows) {
    if (!row.tax_kind) continue;
    const amount = Number(row.total_amount) || 0;
    if (amount <= 0) continue;
    byKind.set(String(row.tax_kind), amount);
  }

  for (const kind of TAX_ANNUAL_KINDS) {
    const total = byKind.get(kind);
    if (total == null) continue;
    await client.query(
      `INSERT INTO tax_annual_totals (budget_id, user_id, group_id, tax_year, tax_kind, total_amount, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (budget_id, tax_year, tax_kind) DO NOTHING`,
      [budgetId, userId, groupId, taxYear, kind, total],
    );
  }
}

/** Refresh totals for the transaction year (and optional prior year if date changed). */
export async function refreshTaxAnnualTotalsAfterChange(
  client: DbClient,
  budgetId: number,
  userId: number,
  groupId: number | null,
  years: Array<number | null | undefined>,
) {
  const uniqueYears = [
    ...new Set(
      years
        .map((y) => (y == null ? NaN : Number(y)))
        .filter((y) => Number.isFinite(y) && y >= 2000 && y <= 2100),
    ),
  ];
  for (const year of uniqueYears) {
    await refreshTaxAnnualTotalsForYear(client, budgetId, userId, groupId, year);
  }
}

/**
 * Increment (or decrement) a cached tax annual total.
 * Used when adding/editing/deleting tax transactions so YTD keeps a manual
 * baseline and only changes by the transaction delta.
 */
export async function applyTaxAnnualTotalDelta(
  client: DbClient,
  budgetId: number,
  userId: number,
  groupId: number | null,
  taxYear: number | null | undefined,
  taxKind: TaxAnnualKind | null | undefined,
  deltaAmount: number,
) {
  const year = taxYear == null ? NaN : Number(taxYear);
  if (!taxKind || !Number.isFinite(year) || year < 2000 || year > 2100) return;
  const delta = Number(deltaAmount);
  if (!Number.isFinite(delta) || delta === 0) return;

  await client.query(
    `INSERT INTO tax_annual_totals (budget_id, user_id, group_id, tax_year, tax_kind, total_amount, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (budget_id, tax_year, tax_kind)
     DO UPDATE SET
       total_amount = GREATEST(0, tax_annual_totals.total_amount + EXCLUDED.total_amount),
       user_id = EXCLUDED.user_id,
       group_id = EXCLUDED.group_id,
       updated_at = NOW()`,
    [budgetId, userId, groupId, year, taxKind, delta],
  );
}

/** Add/subtract a tax transaction amount from the matching annual kind total. */
export async function adjustTaxAnnualTotalForClassification(
  client: DbClient,
  budgetId: number,
  userId: number,
  groupId: number | null,
  taxYear: number | null | undefined,
  category: string | null | undefined,
  subCategory: string | null | undefined,
  signedAmount: number,
) {
  const kind = classifyTaxAnnualKind(category, subCategory);
  if (!kind) return;
  await applyTaxAnnualTotalDelta(client, budgetId, userId, groupId, taxYear, kind, signedAmount);
}

export function yearFromDateString(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const m = String(dateStr).match(/^(\d{4})/);
  if (!m) return null;
  const y = Number(m[1]);
  return Number.isFinite(y) ? y : null;
}
