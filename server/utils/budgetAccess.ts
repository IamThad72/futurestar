import { createError } from "h3";
import { groupAccessClause, soloUserClause } from "./group";

export type DbClient = {
  query: (queryText: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
};

export type BudgetRow = {
  budget_id: number;
  user_id: number;
  group_id: number | null;
  name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export function budgetsAccessClause(groupId: number | null, alias = "", paramIndex = 1) {
  const prefix = alias ? `${alias}.` : "";
  if (groupId) {
    return `${prefix}group_id = $${paramIndex}`;
  }
  return `${prefix}user_id = $${paramIndex} AND ${prefix}group_id IS NULL`;
}

export function budgetsOwnerParams(userId: number, groupId: number | null) {
  return groupId ? [groupId] : [userId];
}

export async function listBudgets(client: DbClient, userId: number, groupId: number | null): Promise<BudgetRow[]> {
  const access = budgetsAccessClause(groupId);
  const params = budgetsOwnerParams(userId, groupId);
  const result = await client.query(
    `SELECT budget_id, user_id, group_id, name, is_active, created_at, updated_at
     FROM budgets
     WHERE ${access}
     ORDER BY is_active DESC, lower(name) ASC, budget_id ASC`,
    params,
  );
  return result.rows as BudgetRow[];
}

export async function ensureActiveBudget(
  client: DbClient,
  userId: number,
  groupId: number | null,
): Promise<BudgetRow> {
  const existing = await listBudgets(client, userId, groupId);
  const active = existing.find((b) => b.is_active);
  if (active) return active;
  if (existing[0]) {
    await client.query(`UPDATE budgets SET is_active = TRUE, updated_at = NOW() WHERE budget_id = $1`, [
      existing[0].budget_id,
    ]);
    return { ...existing[0], is_active: true };
  }
  const inserted = await client.query(
    `INSERT INTO budgets (user_id, group_id, name, is_active)
     VALUES ($1, $2, 'Main', TRUE)
     RETURNING budget_id, user_id, group_id, name, is_active, created_at, updated_at`,
    [userId, groupId],
  );
  return inserted.rows[0] as BudgetRow;
}

export async function getActiveBudget(
  client: DbClient,
  userId: number,
  groupId: number | null,
): Promise<BudgetRow> {
  return ensureActiveBudget(client, userId, groupId);
}

export type MonthAssignmentRow = {
  assignment_id: number;
  year: number;
  month: number;
  budget_id: number;
};

export function parseYearMonth(yearRaw: unknown, monthRaw: unknown): { year: number; month: number } {
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    throw createError({ statusCode: 400, statusMessage: "Invalid year." });
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    throw createError({ statusCode: 400, statusMessage: "Invalid month." });
  }
  return { year: Math.trunc(year), month: Math.trunc(month) };
}

/** Inclusive start / exclusive end date strings for a calendar month (index-friendly). */
export function monthDateRange(year: number, month: number): { start: string; end: string } {
  const y = Math.trunc(year);
  const m = Math.trunc(month);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const end =
    m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { start, end };
}

export async function getMonthAssignment(
  client: DbClient,
  userId: number,
  groupId: number | null,
  year: number,
  month: number,
): Promise<MonthAssignmentRow | null> {
  const access = budgetsAccessClause(groupId);
  const params = [...budgetsOwnerParams(userId, groupId), year, month];
  const result = await client.query(
    `SELECT assignment_id, year, month, budget_id
     FROM budget_month_assignments
     WHERE ${access} AND year = $2 AND month = $3
     LIMIT 1`,
    params,
  );
  return (result.rows[0] as MonthAssignmentRow | undefined) ?? null;
}

/**
 * Budget for a calendar month:
 * 1) explicit month assignment
 * 2) active default, if it has activity that month (or the month has no txs yet)
 * 3) otherwise the budget that already holds that month's transactions (inferred)
 */
export async function getBudgetForPeriod(
  client: DbClient,
  userId: number,
  groupId: number | null,
  year: number,
  month: number,
): Promise<{ budget: BudgetRow; is_override: boolean; is_inferred: boolean }> {
  const assignment = await getMonthAssignment(client, userId, groupId, year, month);
  if (assignment) {
    const budget = await getBudgetById(client, userId, groupId, assignment.budget_id);
    return { budget, is_override: true, is_inferred: false };
  }

  const active = await getActiveBudget(client, userId, groupId);
  const { start, end } = monthDateRange(year, month);
  const txAccess = groupId ? groupAccessClause("t") : soloUserClause("t");
  const activityParams = groupId ? [userId, groupId, start, end] : [userId, start, end];
  const startParam = groupId ? "$3" : "$2";
  const endParam = groupId ? "$4" : "$3";
  const activity = await client.query(
    `SELECT COALESCE(i.budget_id, e.budget_id) AS budget_id, COUNT(*)::int AS n
     FROM budget_transactions t
     LEFT JOIN income i ON t.income_id = i.income_id
     LEFT JOIN expenses e ON t.expense_id = e.expense_id
     WHERE ${txAccess}
       AND t.transaction_date >= ${startParam}::date
       AND t.transaction_date < ${endParam}::date
       AND COALESCE(i.budget_id, e.budget_id) IS NOT NULL
     GROUP BY 1
     ORDER BY n DESC, budget_id ASC`,
    activityParams,
  );

  const rows = activity.rows as Array<{ budget_id: number; n: number }>;
  if (!rows.length) {
    return { budget: active, is_override: false, is_inferred: false };
  }

  const activeCount = rows.find((r) => Number(r.budget_id) === active.budget_id)?.n ?? 0;
  if (activeCount > 0) {
    return { budget: active, is_override: false, is_inferred: false };
  }

  const topId = Number(rows[0]?.budget_id);
  if (Number.isFinite(topId) && topId > 0) {
    try {
      const budget = await getBudgetById(client, userId, groupId, topId);
      return { budget, is_override: false, is_inferred: true };
    } catch {
      // fall through to active
    }
  }
  return { budget: active, is_override: false, is_inferred: false };
}

export async function listMonthAssignments(
  client: DbClient,
  userId: number,
  groupId: number | null,
  opts: { budgetId?: number; year?: number } = {},
): Promise<MonthAssignmentRow[]> {
  const access = budgetsAccessClause(groupId);
  const params: unknown[] = [...budgetsOwnerParams(userId, groupId)];
  let sql = `SELECT assignment_id, year, month, budget_id
             FROM budget_month_assignments
             WHERE ${access}`;
  if (opts.budgetId != null) {
    params.push(opts.budgetId);
    sql += ` AND budget_id = $${params.length}`;
  }
  if (opts.year != null) {
    params.push(opts.year);
    sql += ` AND year = $${params.length}`;
  }
  sql += ` ORDER BY year DESC, month ASC`;
  const result = await client.query(sql, params);
  return result.rows as MonthAssignmentRow[];
}

export async function setMonthAssignment(
  client: DbClient,
  userId: number,
  groupId: number | null,
  year: number,
  month: number,
  budgetId: number,
): Promise<MonthAssignmentRow> {
  await getBudgetById(client, userId, groupId, budgetId);
  const existing = await getMonthAssignment(client, userId, groupId, year, month);
  if (existing) {
    const updated = await client.query(
      `UPDATE budget_month_assignments
       SET budget_id = $1, updated_at = NOW()
       WHERE assignment_id = $2
       RETURNING assignment_id, year, month, budget_id`,
      [budgetId, existing.assignment_id],
    );
    return updated.rows[0] as MonthAssignmentRow;
  }
  const inserted = await client.query(
    `INSERT INTO budget_month_assignments (user_id, group_id, year, month, budget_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING assignment_id, year, month, budget_id`,
    [userId, groupId, year, month, budgetId],
  );
  return inserted.rows[0] as MonthAssignmentRow;
}

export async function clearMonthAssignment(
  client: DbClient,
  userId: number,
  groupId: number | null,
  year: number,
  month: number,
): Promise<boolean> {
  const existing = await getMonthAssignment(client, userId, groupId, year, month);
  if (!existing) return false;
  await client.query(`DELETE FROM budget_month_assignments WHERE assignment_id = $1`, [
    existing.assignment_id,
  ]);
  return true;
}

export async function getBudgetById(
  client: DbClient,
  userId: number,
  groupId: number | null,
  budgetId: number,
): Promise<BudgetRow> {
  const access = budgetsAccessClause(groupId, "", 2);
  const params = [budgetId, ...budgetsOwnerParams(userId, groupId)];
  const result = await client.query(
    `SELECT budget_id, user_id, group_id, name, is_active, created_at, updated_at
     FROM budgets
     WHERE budget_id = $1 AND ${access}
     LIMIT 1`,
    params,
  );
  const row = result.rows[0] as BudgetRow | undefined;
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "Budget not found." });
  }
  return row;
}

/** Resolve selected budget (query/body) or fall back to active. */
export async function resolveBudgetId(
  client: DbClient,
  userId: number,
  groupId: number | null,
  requested: unknown,
): Promise<BudgetRow> {
  if (requested != null && requested !== "") {
    const id = Number(requested);
    if (!Number.isFinite(id) || id <= 0) {
      throw createError({ statusCode: 400, statusMessage: "Invalid budget_id." });
    }
    return getBudgetById(client, userId, groupId, id);
  }
  return getActiveBudget(client, userId, groupId);
}

export async function activateBudget(
  client: DbClient,
  userId: number,
  groupId: number | null,
  budgetId: number,
): Promise<BudgetRow> {
  const budget = await getBudgetById(client, userId, groupId, budgetId);
  if (groupId) {
    await client.query(`UPDATE budgets SET is_active = FALSE, updated_at = NOW() WHERE group_id = $1 AND is_active`, [
      groupId,
    ]);
  } else {
    await client.query(
      `UPDATE budgets SET is_active = FALSE, updated_at = NOW()
       WHERE user_id = $1 AND group_id IS NULL AND is_active`,
      [userId],
    );
  }
  await client.query(`UPDATE budgets SET is_active = TRUE, updated_at = NOW() WHERE budget_id = $1`, [budget.budget_id]);
  return { ...budget, is_active: true };
}

/** Plan-line access: owner access AND budget_id match. Params: [$1 user, $2 group?, $budgetParam budget] */
export function planLineAccessWithBudget(groupId: number | null, budgetParamIndex: number, alias = "") {
  const owner = groupId ? groupAccessClause(alias) : soloUserClause(alias);
  const prefix = alias ? `${alias}.` : "";
  return `${owner} AND ${prefix}budget_id = $${budgetParamIndex}`;
}
