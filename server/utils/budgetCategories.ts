import { createError } from "h3";
import { groupAccessClause, soloUserClause, groupAccessClauseAt, soloUserClauseAt } from "./group";
import { classificationMatchKey } from "./budgetTransactions";
import type { DbClient } from "./budgetAccess";

export type RecordingCatalogEntry = {
  item_kind: "income" | "expense";
  item_type: string;
  category: string;
  sub_category: string | null;
  income_id: number | null;
  expense_id: number | null;
  on_period_plan: boolean;
  description: string | null;
  cash_investment_id: number | null;
  from_cash_investment_id: number | null;
  debt_id: number | null;
};

type CatalogDraft = RecordingCatalogEntry & { line_id: number | null };

function catalogKey(kind: "income" | "expense", itemType: unknown, category: unknown, subCategory: unknown) {
  return `${kind}|${classificationMatchKey(itemType, category, subCategory)}`;
}

function prefer(prev: CatalogDraft | undefined, next: CatalogDraft) {
  if (!prev) return next;
  if (next.on_period_plan && !prev.on_period_plan) return next;
  if (!prev.on_period_plan && !next.on_period_plan && (next.line_id ?? 0) > (prev.line_id ?? 0)) return next;
  return prev;
}

/**
 * Every category this household can record against.
 * Current-period plan lines win when the same category still exists.
 * Otherwise the newest line on any budget is kept.
 * Classifications that only remain on past transactions are included with no line id.
 */
export async function listRecordingCatalog(
  client: DbClient,
  userId: number,
  groupId: number | null,
  periodBudgetId: number | null,
): Promise<RecordingCatalogEntry[]> {
  const access = groupId ? groupAccessClause() : soloUserClause();
  const params = groupId ? [userId, groupId] : [userId];

  const [incomeRes, expenseRes, txRes] = await Promise.all([
    client.query(
      `SELECT income_id AS id, budget_id,
              COALESCE(income_type, 'gross') AS item_type,
              COALESCE(income_category, '') AS category,
              sub_category,
              income_category_desc AS description,
              cash_investment_id
       FROM income
       WHERE ${access}`,
      params,
    ),
    client.query(
      `SELECT expense_id AS id, budget_id,
              COALESCE(expense_type, 'expense') AS item_type,
              COALESCE(expense_category, '') AS category,
              sub_category,
              expense_category_desc AS description,
              cash_investment_id, from_cash_investment_id, debt_id
       FROM expenses
       WHERE ${access}`,
      params,
    ),
    client.query(
      `SELECT DISTINCT
              COALESCE(item_kind, CASE WHEN income_id IS NOT NULL THEN 'income' ELSE 'expense' END) AS item_kind,
              COALESCE(item_type, CASE WHEN income_id IS NOT NULL THEN 'gross' ELSE 'expense' END) AS item_type,
              COALESCE(NULLIF(trim(category), ''), 'Uncategorized') AS category,
              sub_category
       FROM budget_transactions
       WHERE ${access}`,
      params,
    ),
  ]);

  const map = new Map<string, CatalogDraft>();

  for (const row of incomeRes.rows) {
    const category = String(row.category || "").trim();
    if (!category) continue;
    const onPeriod = periodBudgetId != null && Number(row.budget_id) === periodBudgetId;
    const draft: CatalogDraft = {
      item_kind: "income",
      item_type: String(row.item_type || "gross"),
      category,
      sub_category: row.sub_category != null && String(row.sub_category).trim() ? String(row.sub_category) : null,
      income_id: Number(row.id),
      expense_id: null,
      on_period_plan: onPeriod,
      description: row.description != null ? String(row.description) : null,
      cash_investment_id: row.cash_investment_id != null ? Number(row.cash_investment_id) : null,
      from_cash_investment_id: null,
      debt_id: null,
      line_id: Number(row.id),
    };
    const key = catalogKey("income", draft.item_type, draft.category, draft.sub_category);
    map.set(key, prefer(map.get(key), draft));
  }

  for (const row of expenseRes.rows) {
    const category = String(row.category || "").trim();
    if (!category) continue;
    const onPeriod = periodBudgetId != null && Number(row.budget_id) === periodBudgetId;
    const draft: CatalogDraft = {
      item_kind: "expense",
      item_type: String(row.item_type || "expense"),
      category,
      sub_category: row.sub_category != null && String(row.sub_category).trim() ? String(row.sub_category) : null,
      income_id: null,
      expense_id: Number(row.id),
      on_period_plan: onPeriod,
      description: row.description != null ? String(row.description) : null,
      cash_investment_id: row.cash_investment_id != null ? Number(row.cash_investment_id) : null,
      from_cash_investment_id: row.from_cash_investment_id != null ? Number(row.from_cash_investment_id) : null,
      debt_id: row.debt_id != null ? Number(row.debt_id) : null,
      line_id: Number(row.id),
    };
    const key = catalogKey("expense", draft.item_type, draft.category, draft.sub_category);
    map.set(key, prefer(map.get(key), draft));
  }

  for (const row of txRes.rows) {
    const kind = String(row.item_kind || "").toLowerCase() === "income" ? "income" : "expense";
    const defaultType = kind === "income" ? "gross" : "expense";
    const category = String(row.category || "").trim();
    if (!category) continue;
    const draft: CatalogDraft = {
      item_kind: kind,
      item_type: String(row.item_type || defaultType),
      category,
      sub_category: row.sub_category != null && String(row.sub_category).trim() ? String(row.sub_category) : null,
      income_id: null,
      expense_id: null,
      on_period_plan: false,
      description: null,
      cash_investment_id: null,
      from_cash_investment_id: null,
      debt_id: null,
      line_id: null,
    };
    const key = catalogKey(kind, draft.item_type, draft.category, draft.sub_category);
    if (!map.has(key)) map.set(key, draft);
  }

  return [...map.values()]
    .map(({ line_id: _lineId, ...entry }) => entry)
    .sort((a, b) => {
      const cat = a.category.localeCompare(b.category);
      if (cat !== 0) return cat;
      return String(a.sub_category || "").localeCompare(String(b.sub_category || ""));
    });
}

export async function resolveRecordingTarget(
  client: DbClient,
  userId: number,
  groupId: number | null,
  input: {
    kind: "income" | "expense";
    lineId?: number | null;
    itemType?: unknown;
    category?: unknown;
    subCategory?: unknown;
  },
): Promise<{
  incomeId: number | null;
  expenseId: number | null;
  itemKind: "income" | "expense";
  itemType: string;
  category: string;
  subCategory: string | null;
}> {
  const kind = input.kind;
  const defaultType = kind === "income" ? "gross" : "expense";
  const lineId = input.lineId != null ? Number(input.lineId) : null;

  if (lineId != null && Number.isFinite(lineId) && lineId > 0) {
    const table = kind === "income" ? "income" : "expenses";
    const idCol = kind === "income" ? "income_id" : "expense_id";
    const typeCol = kind === "income" ? "income_type" : "expense_type";
    const catCol = kind === "income" ? "income_category" : "expense_category";
    const access = groupId ? groupAccessClauseAt("", 2, 3) : soloUserClauseAt("", 2);
    const ownerParams = groupId ? [userId, groupId] : [userId];
    const result = await client.query(
      `SELECT ${idCol} AS id,
              COALESCE(${typeCol}, '${defaultType}') AS item_type,
              COALESCE(${catCol}, '') AS category,
              sub_category
       FROM ${table}
       WHERE ${idCol} = $1 AND ${access}
       LIMIT 1`,
      [lineId, ...ownerParams],
    );
    const row = result.rows[0] as
      | { id: number; item_type: string; category: string; sub_category: string | null }
      | undefined;
    if (!row) {
      throw createError({
        statusCode: 400,
        statusMessage: kind === "income" ? "Invalid income budget item." : "Invalid expense budget item.",
      });
    }
    return {
      incomeId: kind === "income" ? Number(row.id) : null,
      expenseId: kind === "expense" ? Number(row.id) : null,
      itemKind: kind,
      itemType: String(row.item_type || defaultType),
      category: String(row.category || "Uncategorized"),
      subCategory: row.sub_category != null && String(row.sub_category).trim() ? String(row.sub_category) : null,
    };
  }

  const category = String(input.category ?? "").trim();
  if (!category) {
    throw createError({
      statusCode: 400,
      statusMessage: kind === "income" ? "Income category is required." : "Expense category is required.",
    });
  }
  const itemType = String(input.itemType ?? "").trim() || defaultType;
  const sub =
    input.subCategory != null && String(input.subCategory).trim() ? String(input.subCategory).trim() : null;
  const wanted = catalogKey(kind, itemType, category, sub);
  const catalog = await listRecordingCatalog(client, userId, groupId, null);
  const match = catalog.find(
    (entry) => catalogKey(entry.item_kind, entry.item_type, entry.category, entry.sub_category) === wanted,
  );
  if (!match) {
    throw createError({
      statusCode: 400,
      statusMessage: "That category is not available for new transactions.",
    });
  }
  return {
    incomeId: match.income_id,
    expenseId: match.expense_id,
    itemKind: kind,
    itemType: match.item_type,
    category: match.category,
    subCategory: match.sub_category,
  };
}
