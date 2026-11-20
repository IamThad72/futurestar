import { isGrossPaycheckAnchor } from "./grossPayTransaction";
import { groupAccessClause, groupAccessClauseAt, soloUserClause, soloUserClauseAt } from "./group";
import { listBudgets } from "./budgetAccess";
import { summarizeBudgetPlan } from "~/utils/tax/project.js";

type DbClient = {
  query: (queryText: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
};

function countPaychecks(rows: Array<Record<string, unknown>>) {
  const batches = new Set<string>();
  let unbatched = 0;
  for (const row of rows) {
    if (!isGrossPaycheckAnchor(row)) continue;
    const batch = row.pay_batch_id != null ? String(row.pay_batch_id) : "";
    if (batch) batches.add(batch);
    else unbatched += 1;
  }
  return batches.size + unbatched;
}

export async function countHouseholdPaychecks(
  client: DbClient,
  userId: number,
  groupId: number | null,
  taxYear: number,
) {
  const access = groupId ? groupAccessClauseAt("t", 2, 3) : soloUserClauseAt("t", 2);
  const params = groupId ? [taxYear, userId, groupId] : [taxYear, userId];
  const result = await client.query(
    `SELECT t.transaction_id, t.pay_batch_id, t.item_kind, t.item_type, t.category, t.sub_category,
            t.from_gross_pay, t.income_id
     FROM budget_transactions t
     WHERE EXTRACT(YEAR FROM t.transaction_date) = $1
       AND COALESCE(t.from_gross_pay, false) = true
       AND ${access}`,
    params,
  );
  return countPaychecks(result.rows);
}

export async function loadBudgetPlan(client: DbClient, userId: number, groupId: number | null) {
  const budgets = await listBudgets(client, userId, groupId);
  const active = budgets.find((budget) => budget.is_active);
  if (!active) return null;
  const ownerAccess = groupId ? groupAccessClause() : soloUserClause();
  const budgetParam = groupId ? "$3" : "$2";
  const params = groupId ? [userId, groupId, active.budget_id] : [userId, active.budget_id];
  const income = await client.query(
    `SELECT 'income' AS item_kind, COALESCE(income_type, 'gross') AS item_type,
            income_category AS category, sub_category,
            income_category_annual_amt AS annual_amount
     FROM income
     WHERE ${ownerAccess} AND budget_id = ${budgetParam}`,
    params,
  );
  const expenses = await client.query(
    `SELECT 'expense' AS item_kind, COALESCE(expense_type, 'expense') AS item_type,
            expense_category AS category, sub_category,
            annual_budget_amt AS annual_amount
     FROM expenses
     WHERE ${ownerAccess} AND budget_id = ${budgetParam}`,
    params,
  );
  return summarizeBudgetPlan([...income.rows, ...expenses.rows]);
}
