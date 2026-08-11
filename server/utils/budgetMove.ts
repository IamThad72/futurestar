import { groupAccessClause, soloUserClause } from "./group";
import { getBudgetById, type DbClient } from "./budgetAccess";

function lineMatchKey(type: string, category: unknown, subCategory: unknown) {
  const cat = String(category ?? "")
    .trim()
    .toLowerCase();
  const sub = String(subCategory ?? "")
    .trim()
    .toLowerCase();
  return `${String(type ?? "")
    .trim()
    .toLowerCase()}|${cat}|${sub}`;
}

export type MoveMonthTransactionsResult = {
  moved: number;
  already_on_target: number;
  unmatched: number;
  unmatched_samples: Array<{
    transaction_id: number;
    kind: "income" | "expense";
    category: string | null;
    sub_category: string | null;
    item_type: string | null;
  }>;
  from_budget_ids: number[];
  to_budget_id: number;
};

/**
 * Remap a calendar month's transactions onto matching plan lines of `toBudgetId`
 * (match by income/expense type + category + subcategory).
 */
export async function moveMonthTransactionsToBudget(
  client: DbClient,
  userId: number,
  groupId: number | null,
  year: number,
  month: number,
  toBudgetId: number,
): Promise<MoveMonthTransactionsResult> {
  await getBudgetById(client, userId, groupId, toBudgetId);

  const incomeTarget = await client.query(
    `SELECT income_id, COALESCE(income_type, 'gross') AS item_type, income_category AS category, sub_category,
            income_category_monthly_amt AS monthly_amount
     FROM income WHERE budget_id = $1`,
    [toBudgetId],
  );
  const expenseTarget = await client.query(
    `SELECT expense_id, COALESCE(expense_type, 'expense') AS item_type, expense_category AS category, sub_category,
            monthly_budget_amt AS monthly_amount
     FROM expenses WHERE budget_id = $1`,
    [toBudgetId],
  );

  const incomeMap = new Map<string, number>();
  const incomeAmountMap = new Map<string, number[]>();
  for (const row of incomeTarget.rows) {
    const k = lineMatchKey(row.item_type, row.category, row.sub_category);
    if (!incomeMap.has(k)) incomeMap.set(k, Number(row.income_id));
    const amtKey = `${lineMatchKey(row.item_type, row.category, "")}|${Number(row.monthly_amount ?? NaN)}`;
    const list = incomeAmountMap.get(amtKey) || [];
    list.push(Number(row.income_id));
    incomeAmountMap.set(amtKey, list);
  }
  const expenseMap = new Map<string, number>();
  const expenseAmountMap = new Map<string, number[]>();
  for (const row of expenseTarget.rows) {
    const k = lineMatchKey(row.item_type, row.category, row.sub_category);
    if (!expenseMap.has(k)) expenseMap.set(k, Number(row.expense_id));
    const amtKey = `${lineMatchKey(row.item_type, row.category, "")}|${Number(row.monthly_amount ?? NaN)}`;
    const list = expenseAmountMap.get(amtKey) || [];
    list.push(Number(row.expense_id));
    expenseAmountMap.set(amtKey, list);
  }

  function resolveTargetId(
    exactMap: Map<string, number>,
    amountMap: Map<string, number[]>,
    itemType: string,
    category: unknown,
    subCategory: unknown,
    monthlyAmount: unknown,
  ) {
    const exact = exactMap.get(lineMatchKey(itemType, category, subCategory));
    if (exact != null) return exact;
    const amt = Number(monthlyAmount);
    if (!Number.isFinite(amt)) return null;
    const candidates = amountMap.get(`${lineMatchKey(itemType, category, "")}|${amt}`) || [];
    return candidates.length === 1 ? candidates[0] : null;
  }

  const txAccess = groupId ? groupAccessClause("t") : soloUserClause("t");
  const listParams = groupId ? [userId, groupId, year, month] : [userId, year, month];
  const yearParam = groupId ? "$3" : "$2";
  const monthParam = groupId ? "$4" : "$3";

  const txs = await client.query(
    `SELECT t.transaction_id, t.income_id, t.expense_id,
            i.budget_id AS income_budget_id,
            e.budget_id AS expense_budget_id,
            COALESCE(i.income_type, 'gross') AS income_type,
            i.income_category,
            i.sub_category AS income_sub_category,
            i.income_category_monthly_amt AS income_monthly_amount,
            COALESCE(e.expense_type, 'expense') AS expense_type,
            e.expense_category,
            e.sub_category AS expense_sub_category,
            e.monthly_budget_amt AS expense_monthly_amount
     FROM budget_transactions t
     LEFT JOIN income i ON t.income_id = i.income_id
     LEFT JOIN expenses e ON t.expense_id = e.expense_id
     WHERE ${txAccess}
       AND EXTRACT(YEAR FROM t.transaction_date) = ${yearParam}
       AND EXTRACT(MONTH FROM t.transaction_date) = ${monthParam}
     ORDER BY t.transaction_id ASC`,
    listParams,
  );

  let moved = 0;
  let alreadyOnTarget = 0;
  let unmatched = 0;
  const unmatchedSamples: MoveMonthTransactionsResult["unmatched_samples"] = [];
  const fromBudgetIds = new Set<number>();

  await client.query("BEGIN");
  try {
    for (const row of txs.rows) {
      if (row.income_id != null) {
        const fromBudgetId = row.income_budget_id != null ? Number(row.income_budget_id) : null;
        if (fromBudgetId === toBudgetId) {
          alreadyOnTarget += 1;
          continue;
        }
        if (fromBudgetId != null) {
          fromBudgetIds.add(fromBudgetId);
        }
        const nextId = resolveTargetId(
          incomeMap,
          incomeAmountMap,
          row.income_type,
          row.income_category,
          row.income_sub_category,
          row.income_monthly_amount,
        );
        if (nextId == null) {
          unmatched += 1;
          if (unmatchedSamples.length < 20) {
            unmatchedSamples.push({
              transaction_id: Number(row.transaction_id),
              kind: "income",
              category: row.income_category ?? null,
              sub_category: row.income_sub_category ?? null,
              item_type: row.income_type ?? null,
            });
          }
          continue;
        }
        await client.query(`UPDATE budget_transactions SET income_id = $1 WHERE transaction_id = $2`, [
          nextId,
          row.transaction_id,
        ]);
        moved += 1;
        continue;
      }

      if (row.expense_id != null) {
        const fromBudgetId = row.expense_budget_id != null ? Number(row.expense_budget_id) : null;
        if (fromBudgetId === toBudgetId) {
          alreadyOnTarget += 1;
          continue;
        }
        if (fromBudgetId != null) {
          fromBudgetIds.add(fromBudgetId);
        }
        const nextId = resolveTargetId(
          expenseMap,
          expenseAmountMap,
          row.expense_type,
          row.expense_category,
          row.expense_sub_category,
          row.expense_monthly_amount,
        );
        if (nextId == null) {
          unmatched += 1;
          if (unmatchedSamples.length < 20) {
            unmatchedSamples.push({
              transaction_id: Number(row.transaction_id),
              kind: "expense",
              category: row.expense_category ?? null,
              sub_category: row.expense_sub_category ?? null,
              item_type: row.expense_type ?? null,
            });
          }
          continue;
        }
        await client.query(`UPDATE budget_transactions SET expense_id = $1 WHERE transaction_id = $2`, [
          nextId,
          row.transaction_id,
        ]);
        moved += 1;
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  }

  return {
    moved,
    already_on_target: alreadyOnTarget,
    unmatched,
    unmatched_samples: unmatchedSamples,
    from_budget_ids: [...fromBudgetIds],
    to_budget_id: toBudgetId,
  };
}
