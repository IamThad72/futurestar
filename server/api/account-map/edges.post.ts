import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId, groupAccessClauseAt, soloUserClauseAt } from "../../utils/group";
import { resolveBudgetId } from "../../utils/budgetAccess";
import {
  classifyEdgePersistence,
  defaultEdgeKind,
  edgeLabel,
  isEdgeKind,
  isNodeType,
  nodeKey,
  parseNodeKey,
  type EdgeKind,
  type NodeType,
} from "../../utils/accountMap";

async function assertAccessible(
  client: { query: (q: string, v?: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number | null }> },
  userId: number,
  groupId: number | null,
  type: NodeType,
  id: number,
  budgetId?: number | null,
) {
  const tableMap: Record<NodeType, { table: string; idCol: string; budgetScoped: boolean }> = {
    asset_inventory: { table: "asset_inventory", idCol: "ai_id", budgetScoped: false },
    asset_vehicles: { table: "asset_vehicles", idCol: "vh_id", budgetScoped: false },
    cash_and_investments: { table: "cash_and_investments", idCol: "ci_id", budgetScoped: false },
    debt: { table: "debt", idCol: "dbt_id", budgetScoped: false },
    real_estate: { table: "real_estate", idCol: "re_id", budgetScoped: false },
    insurance: { table: "insurance", idCol: "ins_id", budgetScoped: false },
    income: { table: "income", idCol: "income_id", budgetScoped: true },
    expense: { table: "expenses", idCol: "expense_id", budgetScoped: true },
  };
  const cfg = tableMap[type];
  const access = groupId ? groupAccessClauseAt("", 2, 3) : soloUserClauseAt("", 2);
  if (cfg.budgetScoped) {
    if (budgetId == null) {
      throw createError({ statusCode: 400, statusMessage: "budget_id is required for budget lines." });
    }
    const budgetParam = groupId ? "$4" : "$3";
    const params = groupId ? [id, userId, groupId, budgetId] : [id, userId, budgetId];
    const result = await client.query(
      `SELECT 1 FROM ${cfg.table} WHERE ${cfg.idCol} = $1 AND ${access} AND budget_id = ${budgetParam}`,
      params,
    );
    if (!result.rowCount) {
      throw createError({ statusCode: 404, statusMessage: `Record not found: ${type}:${id}` });
    }
    return;
  }
  const params = groupId ? [id, userId, groupId] : [id, userId];
  const result = await client.query(
    `SELECT 1 FROM ${cfg.table} WHERE ${cfg.idCol} = $1 AND ${access}`,
    params,
  );
  if (!result.rowCount) {
    throw createError({ statusCode: 404, statusMessage: `Record not found: ${type}:${id}` });
  }
}

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const body = await readBody(event);

  const sourceKey = String(body?.source ?? body?.from ?? "");
  const targetKey = String(body?.target ?? body?.to ?? "");
  const source = parseNodeKey(sourceKey);
  const target = parseNodeKey(targetKey);
  if (!source || !target) {
    throw createError({ statusCode: 400, statusMessage: "Valid source and target node ids are required." });
  }
  if (sourceKey === targetKey) {
    throw createError({ statusCode: 400, statusMessage: "Cannot connect a node to itself." });
  }

  let edgeKind: EdgeKind = defaultEdgeKind(source.type, target.type);
  if (body?.edge_kind != null) {
    if (!isEdgeKind(body.edge_kind)) {
      throw createError({ statusCode: 400, statusMessage: "Invalid edge_kind." });
    }
    edgeKind = body.edge_kind;
  }

  const persistence = classifyEdgePersistence(source.type, target.type, edgeKind);
  if (!persistence) {
    throw createError({ statusCode: 400, statusMessage: "This connection type is not supported." });
  }

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const budget = await resolveBudgetId(client, userId, groupId, body?.budget_id);
    await assertAccessible(client, userId, groupId, source.type, source.id, budget.budget_id);
    await assertAccessible(client, userId, groupId, target.type, target.id, budget.budget_id);

    if (persistence === "debt_link") {
      const access = groupId ? groupAccessClauseAt("", 4, 5) : soloUserClauseAt("", 4);
      const params = groupId
        ? [target.type, target.id, source.id, userId, groupId]
        : [target.type, target.id, source.id, userId];
      const result = await client.query(
        `UPDATE debt SET linked_asset_type = $1, linked_asset_id = $2
         WHERE dbt_id = $3 AND ${access}`,
        params,
      );
      if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: "Debt not found." });
      return {
        success: true,
        edge: {
          id: `fk:debt_link:${source.id}`,
          source: nodeKey(source.type, source.id),
          target: nodeKey(target.type, target.id),
          edge_kind: edgeKind,
          persistence,
          label: edgeLabel(edgeKind),
        },
      };
    }

    if (persistence === "income_deposit") {
      const access = groupId ? groupAccessClauseAt("", 3, 4) : soloUserClauseAt("", 3);
      const budgetParam = groupId ? "$5" : "$4";
      const params = groupId
        ? [target.id, source.id, userId, groupId, budget.budget_id]
        : [target.id, source.id, userId, budget.budget_id];
      const result = await client.query(
        `UPDATE income SET cash_investment_id = $1
         WHERE income_id = $2 AND ${access} AND budget_id = ${budgetParam}`,
        params,
      );
      if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: "Income line not found." });
      return {
        success: true,
        edge: {
          id: `fk:income_deposit:${source.id}`,
          source: nodeKey(source.type, source.id),
          target: nodeKey(target.type, target.id),
          edge_kind: edgeKind,
          persistence,
          label: edgeLabel(edgeKind),
        },
      };
    }

    if (persistence === "expense_destination") {
      const access = groupId ? groupAccessClauseAt("", 3, 4) : soloUserClauseAt("", 3);
      const budgetParam = groupId ? "$5" : "$4";
      const params = groupId
        ? [target.id, source.id, userId, groupId, budget.budget_id]
        : [target.id, source.id, userId, budget.budget_id];
      const result = await client.query(
        `UPDATE expenses SET cash_investment_id = $1
         WHERE expense_id = $2 AND ${access} AND budget_id = ${budgetParam}`,
        params,
      );
      if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: "Expense line not found." });
      return {
        success: true,
        edge: {
          id: `fk:expense_destination:${source.id}`,
          source: nodeKey(source.type, source.id),
          target: nodeKey(target.type, target.id),
          edge_kind: edgeKind,
          persistence,
          label: edgeLabel(edgeKind),
        },
      };
    }

    if (persistence === "expense_source") {
      const access = groupId ? groupAccessClauseAt("", 3, 4) : soloUserClauseAt("", 3);
      const budgetParam = groupId ? "$5" : "$4";
      const params = groupId
        ? [source.id, target.id, userId, groupId, budget.budget_id]
        : [source.id, target.id, userId, budget.budget_id];
      const result = await client.query(
        `UPDATE expenses SET from_cash_investment_id = $1
         WHERE expense_id = $2 AND ${access} AND budget_id = ${budgetParam}`,
        params,
      );
      if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: "Expense line not found." });
      return {
        success: true,
        edge: {
          id: `fk:expense_source:${target.id}`,
          source: nodeKey(source.type, source.id),
          target: nodeKey(target.type, target.id),
          edge_kind: edgeKind,
          persistence,
          label: edgeLabel(edgeKind),
        },
      };
    }

    if (persistence === "expense_debt") {
      const access = groupId ? groupAccessClauseAt("", 3, 4) : soloUserClauseAt("", 3);
      const budgetParam = groupId ? "$5" : "$4";
      const params = groupId
        ? [target.id, source.id, userId, groupId, budget.budget_id]
        : [target.id, source.id, userId, budget.budget_id];
      const result = await client.query(
        `UPDATE expenses SET debt_id = $1
         WHERE expense_id = $2 AND ${access} AND budget_id = ${budgetParam}`,
        params,
      );
      if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: "Expense line not found." });
      return {
        success: true,
        edge: {
          id: `fk:expense_debt:${source.id}`,
          source: nodeKey(source.type, source.id),
          target: nodeKey(target.type, target.id),
          edge_kind: edgeKind,
          persistence,
          label: edgeLabel(edgeKind),
        },
      };
    }

    if (!isNodeType(source.type) || !isNodeType(target.type)) {
      throw createError({ statusCode: 400, statusMessage: "Invalid node types." });
    }
    const inserted = await client.query(
      `INSERT INTO account_map_edges (user_id, group_id, budget_id, from_type, from_id, to_type, to_id, edge_kind)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING
       RETURNING edge_id, from_type, from_id, to_type, to_id, edge_kind`,
      [userId, groupId, budget.budget_id, source.type, source.id, target.type, target.id, edgeKind],
    );
    let row = inserted.rows[0];
    if (!row) {
      const existing = await client.query(
        `SELECT edge_id, from_type, from_id, to_type, to_id, edge_kind FROM account_map_edges
         WHERE from_type = $1 AND from_id = $2 AND to_type = $3 AND to_id = $4 AND edge_kind = $5
           AND budget_id = $6
         LIMIT 1`,
        [source.type, source.id, target.type, target.id, edgeKind, budget.budget_id],
      );
      row = existing.rows[0];
    }
    if (!row) {
      throw createError({ statusCode: 500, statusMessage: "Failed to create edge." });
    }
    return {
      success: true,
      edge: {
        id: `ff:${row.edge_id}`,
        source: nodeKey(String(row.from_type), Number(row.from_id)),
        target: nodeKey(String(row.to_type), Number(row.to_id)),
        edge_kind: String(row.edge_kind) as EdgeKind,
        persistence: "freeform",
        freeform_edge_id: Number(row.edge_id),
        label: edgeLabel(String(row.edge_kind) as EdgeKind),
      },
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("account-map edge create failed", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to create account map edge.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
