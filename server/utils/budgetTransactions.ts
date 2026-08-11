export type TxClassification = {
  item_kind: "income" | "expense";
  item_type: string;
  category: string;
  sub_category: string | null;
};

export type BudgetLineForMatch = {
  id: number;
  kind: "income" | "expense";
  item_type: string;
  category: string;
  sub_category?: string | null;
};

export function classificationMatchKey(
  itemType: unknown,
  category: unknown,
  subCategory: unknown,
) {
  const type = String(itemType ?? "")
    .trim()
    .toLowerCase();
  const cat = String(category ?? "")
    .trim()
    .toLowerCase();
  const sub = String(subCategory ?? "")
    .trim()
    .toLowerCase();
  return `${type}|${cat}|${sub}`;
}

export function buildLineMatchMaps(lines: BudgetLineForMatch[]) {
  const income = new Map<string, number>();
  const expense = new Map<string, number>();
  for (const line of lines) {
    const key = classificationMatchKey(line.item_type, line.category, line.sub_category);
    if (line.kind === "income") {
      if (!income.has(key)) income.set(key, line.id);
    } else if (!expense.has(key)) {
      expense.set(key, line.id);
    }
  }
  return { income, expense };
}

export function matchClassificationToLines(
  classification: TxClassification,
  maps: ReturnType<typeof buildLineMatchMaps>,
): { matched: boolean; income_id: number | null; expense_id: number | null } {
  const key = classificationMatchKey(
    classification.item_type,
    classification.category,
    classification.sub_category,
  );
  if (classification.item_kind === "income") {
    const id = maps.income.get(key);
    return id != null
      ? { matched: true, income_id: id, expense_id: null }
      : { matched: false, income_id: null, expense_id: null };
  }
  const id = maps.expense.get(key);
  return id != null
    ? { matched: true, income_id: null, expense_id: id }
    : { matched: false, income_id: null, expense_id: null };
}

export function classifyTxRow(row: Record<string, unknown>): TxClassification {
  const itemKindRaw = String(row.item_kind || row.type || "").toLowerCase();
  const item_kind: "income" | "expense" =
    itemKindRaw === "income" || row.income_id != null ? "income" : "expense";
  return {
    item_kind,
    item_type: String(
      row.item_type ||
        (item_kind === "income" ? "gross" : "expense"),
    ),
    category: String(row.category || "Uncategorized"),
    sub_category: row.sub_category != null ? String(row.sub_category) : null,
  };
}

/** Attach period-plan match info; split into matched vs orphans. */
export function partitionTransactionsForBudget(
  rows: Array<Record<string, unknown>>,
  incomeLines: Array<Record<string, unknown>>,
  expenseLines: Array<Record<string, unknown>>,
) {
  const maps = buildLineMatchMaps([
    ...incomeLines.map((l) => ({
      id: Number(l.id),
      kind: "income" as const,
      item_type: String(l.income_type || "gross"),
      category: String(l.category || ""),
      sub_category: (l.sub_category as string | null) ?? null,
    })),
    ...expenseLines.map((l) => ({
      id: Number(l.id),
      kind: "expense" as const,
      item_type: String(l.expense_type || "expense"),
      category: String(l.category || ""),
      sub_category: (l.sub_category as string | null) ?? null,
    })),
  ]);

  const transactions: Array<Record<string, unknown>> = [];
  const orphans: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const classification = classifyTxRow(row);
    const match = matchClassificationToLines(classification, maps);
    const enriched = {
      ...row,
      item_kind: classification.item_kind,
      type: classification.item_kind,
      item_type: classification.item_type,
      category: classification.category,
      sub_category: classification.sub_category,
      // Resolved against the period plan (may differ from stored FK)
      matched_income_id: match.income_id,
      matched_expense_id: match.expense_id,
      is_orphan: !match.matched,
      income_id: match.matched ? match.income_id : row.income_id ?? null,
      expense_id: match.matched ? match.expense_id : row.expense_id ?? null,
    };
    if (match.matched) transactions.push(enriched);
    else orphans.push(enriched);
  }

  return { transactions, orphans };
}
