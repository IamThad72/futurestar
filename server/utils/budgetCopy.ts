import { nodeKey, parseNodeKey } from "./accountMap";
import { getBudgetById, type DbClient } from "./budgetAccess";

function remapLayoutJson(
  layoutJson: unknown,
  incomeMap: Map<number, number>,
  expenseMap: Map<number, number>,
) {
  const base =
    layoutJson && typeof layoutJson === "object" && !Array.isArray(layoutJson)
      ? { ...(layoutJson as Record<string, unknown>) }
      : {};
  const positionsIn =
    base.positions && typeof base.positions === "object" && !Array.isArray(base.positions)
      ? (base.positions as Record<string, unknown>)
      : {};
  const positionsOut: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(positionsIn)) {
    const parsed = parseNodeKey(key);
    if (!parsed) {
      positionsOut[key] = value;
      continue;
    }
    if (parsed.type === "income") {
      const next = incomeMap.get(parsed.id);
      if (next != null) positionsOut[nodeKey("income", next)] = value;
      continue;
    }
    if (parsed.type === "expense") {
      const next = expenseMap.get(parsed.id);
      if (next != null) positionsOut[nodeKey("expense", next)] = value;
      continue;
    }
    positionsOut[key] = value;
  }

  const hiddenIn = Array.isArray(base.hidden) ? base.hidden.map(String) : [];
  const hiddenOut: string[] = [];
  for (const key of hiddenIn) {
    const parsed = parseNodeKey(key);
    if (!parsed) {
      hiddenOut.push(key);
      continue;
    }
    if (parsed.type === "income") {
      const next = incomeMap.get(parsed.id);
      if (next != null) hiddenOut.push(nodeKey("income", next));
      continue;
    }
    if (parsed.type === "expense") {
      const next = expenseMap.get(parsed.id);
      if (next != null) hiddenOut.push(nodeKey("expense", next));
      continue;
    }
    hiddenOut.push(key);
  }

  return { ...base, positions: positionsOut, hidden: hiddenOut };
}

export async function copyBudgetContents(
  client: DbClient,
  userId: number,
  groupId: number | null,
  fromBudgetId: number,
  toBudgetId: number,
) {
  await getBudgetById(client, userId, groupId, fromBudgetId);
  await getBudgetById(client, userId, groupId, toBudgetId);

  const incomeMap = new Map<number, number>();
  const expenseMap = new Map<number, number>();

  const incomeRows = await client.query(
    `SELECT income_id, income_type, income_category, sub_category, income_category_desc,
            income_category_monthly_amt, income_category_annual_amt, cash_investment_id
     FROM income WHERE budget_id = $1`,
    [fromBudgetId],
  );

  for (const row of incomeRows.rows) {
    const inserted = await client.query(
      `INSERT INTO income
        (user_id, group_id, budget_id, income_type, income_category, sub_category, income_category_desc,
         income_category_monthly_amt, income_category_annual_amt, cash_investment_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING income_id`,
      [
        userId,
        groupId,
        toBudgetId,
        row.income_type ?? "gross",
        row.income_category,
        row.sub_category ?? null,
        row.income_category_desc ?? null,
        row.income_category_monthly_amt ?? null,
        row.income_category_annual_amt ?? null,
        row.cash_investment_id ?? null,
      ],
    );
    incomeMap.set(Number(row.income_id), Number(inserted.rows[0].income_id));
  }

  const expenseRows = await client.query(
    `SELECT expense_id, expense_type, expense_category, sub_category, expense_category_desc,
            monthly_budget_amt, annual_budget_amt, cash_investment_id, from_cash_investment_id, debt_id
     FROM expenses WHERE budget_id = $1`,
    [fromBudgetId],
  );

  for (const row of expenseRows.rows) {
    const inserted = await client.query(
      `INSERT INTO expenses
        (user_id, group_id, budget_id, expense_type, expense_category, sub_category, expense_category_desc,
         monthly_budget_amt, annual_budget_amt, cash_investment_id, from_cash_investment_id, debt_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING expense_id`,
      [
        userId,
        groupId,
        toBudgetId,
        row.expense_type ?? "expense",
        row.expense_category,
        row.sub_category ?? null,
        row.expense_category_desc ?? null,
        row.monthly_budget_amt ?? null,
        row.annual_budget_amt ?? null,
        row.cash_investment_id ?? null,
        row.from_cash_investment_id ?? null,
        row.debt_id ?? null,
      ],
    );
    expenseMap.set(Number(row.expense_id), Number(inserted.rows[0].expense_id));
  }

  const layoutRes = await client.query(
    `SELECT layout_json FROM account_map_layouts WHERE budget_id = $1 LIMIT 1`,
    [fromBudgetId],
  );
  if (layoutRes.rows[0]) {
    const remapped = remapLayoutJson(layoutRes.rows[0].layout_json, incomeMap, expenseMap);
    await client.query(`DELETE FROM account_map_layouts WHERE budget_id = $1`, [toBudgetId]);
    await client.query(
      `INSERT INTO account_map_layouts (user_id, group_id, budget_id, layout_json)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [userId, groupId, toBudgetId, JSON.stringify(remapped)],
    );
  }

  const edgeRes = await client.query(
    `SELECT from_type, from_id, to_type, to_id, edge_kind
     FROM account_map_edges WHERE budget_id = $1`,
    [fromBudgetId],
  );

  for (const row of edgeRes.rows) {
    let fromId = Number(row.from_id);
    let toId = Number(row.to_id);
    if (row.from_type === "income") {
      const next = incomeMap.get(fromId);
      if (next == null) continue;
      fromId = next;
    } else if (row.from_type === "expense") {
      const next = expenseMap.get(fromId);
      if (next == null) continue;
      fromId = next;
    }
    if (row.to_type === "income") {
      const next = incomeMap.get(toId);
      if (next == null) continue;
      toId = next;
    } else if (row.to_type === "expense") {
      const next = expenseMap.get(toId);
      if (next == null) continue;
      toId = next;
    }
    await client.query(
      `INSERT INTO account_map_edges
        (user_id, group_id, budget_id, from_type, from_id, to_type, to_id, edge_kind)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [userId, groupId, toBudgetId, row.from_type, fromId, row.to_type, toId, row.edge_kind],
    );
  }

  return { incomeMap, expenseMap };
}
