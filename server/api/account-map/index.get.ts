import { createError, getQuery } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupId, groupAccessClause, soloUserClause } from "../../utils/group";
import { resolveBudgetId } from "../../utils/budgetAccess";
import {
  ASSET_LINK_TYPES,
  budgetLineTypeLabel,
  edgeLabel,
  nodeKey,
  type EdgeKind,
  type ResolvedEdge,
} from "../../utils/accountMap";

function formatMoney(val: unknown) {
  if (val == null || val === "") return null;
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  return n;
}

function realEstateLabel(r: Record<string, unknown>) {
  const parts = [r.number, r.street, r.city, r.state, r.zipcode].filter(Boolean);
  return parts.length ? parts.join(" ") : `Real Estate #${r.re_id}`;
}

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const query = getQuery(event);
  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const budget = await resolveBudgetId(client, userId, groupId, query.budget_id);
    const access = groupId ? groupAccessClause() : soloUserClause();
    const params = groupId ? [userId, groupId] : [userId];
    const budgetParams = groupId
      ? [userId, groupId, budget.budget_id]
      : [userId, budget.budget_id];
    const budgetFilter = groupId ? `${access} AND budget_id = $3` : `${access} AND budget_id = $2`;

    const inventory = await client.query(`SELECT * FROM asset_inventory WHERE ${access}`, params);
    const vehicles = await client.query(
      `SELECT vh_id, year, make, model, vin, value FROM asset_vehicles WHERE ${access}`,
      params,
    );
    const cash = await client.query(
      `SELECT ci_id, institution, acct_type, acct_number, value FROM cash_and_investments WHERE ${access}`,
      params,
    );
    const debt = await client.query(
      `SELECT dbt_id, institution, loan_type, loan_ammount, linked_asset_type, linked_asset_id
       FROM debt WHERE ${access}`,
      params,
    );
    const realEstate = await client.query(
      `SELECT re_id, number, street, city, state, zipcode, value FROM real_estate WHERE ${access}`,
      params,
    );
    const insurance = await client.query(
      `SELECT ins_id, policy_holder, entity_covered, policy_amt, polocy_number FROM insurance WHERE ${access}`,
      params,
    );

    let income;
    try {
      income = await client.query(
        `SELECT income_id, income_type, income_category, sub_category, income_category_monthly_amt, cash_investment_id
         FROM income WHERE ${budgetFilter}`,
        budgetParams,
      );
    } catch (err: unknown) {
      const msg = String((err as { message?: string })?.message ?? "");
      if (msg.includes("cash_investment_id") && msg.includes("does not exist")) {
        income = await client.query(
          `SELECT income_id, income_type, income_category, sub_category, income_category_monthly_amt
           FROM income WHERE ${budgetFilter}`,
          budgetParams,
        );
        income.rows = income.rows.map((row) => ({ ...row, cash_investment_id: null }));
      } else {
        throw err;
      }
    }

    let expenses;
    try {
      expenses = await client.query(
        `SELECT expense_id, expense_type, expense_category, sub_category, monthly_budget_amt,
                cash_investment_id, from_cash_investment_id, debt_id
         FROM expenses WHERE ${budgetFilter}`,
        budgetParams,
      );
    } catch (err: unknown) {
      const msg = String((err as { message?: string })?.message ?? "");
      if (msg.includes("does not exist")) {
        expenses = await client.query(
          `SELECT expense_id, expense_type, expense_category, sub_category, monthly_budget_amt
           FROM expenses WHERE ${budgetFilter}`,
          budgetParams,
        );
        expenses.rows = expenses.rows.map((row) => ({
          ...row,
          cash_investment_id: null,
          from_cash_investment_id: null,
          debt_id: null,
        }));
      } else {
        throw err;
      }
    }

    let layoutRes: { rows: Array<{ layout_json?: unknown }> };
    try {
      layoutRes = await client.query(
        `SELECT layout_json FROM account_map_layouts WHERE budget_id = $1 LIMIT 1`,
        [budget.budget_id],
      );
    } catch (err: unknown) {
      const msg = String((err as { message?: string })?.message ?? "");
      if (msg.includes("account_map_layouts") && msg.includes("does not exist")) {
        layoutRes = { rows: [] };
      } else if (msg.includes("budget_id") && msg.includes("does not exist")) {
        // Pre-multi-budget schema fallback
        layoutRes = await client.query(
          `SELECT layout_json FROM account_map_layouts
           WHERE ${groupId ? groupAccessClause() : soloUserClause()}
           ORDER BY updated_at DESC NULLS LAST
           LIMIT 1`,
          params,
        );
      } else {
        throw err;
      }
    }

    let freeformEdges;
    try {
      freeformEdges = await client.query(
        `SELECT edge_id, from_type, from_id, to_type, to_id, edge_kind
         FROM account_map_edges WHERE budget_id = $1`,
        [budget.budget_id],
      );
    } catch (err: unknown) {
      const msg = String((err as { message?: string })?.message ?? "");
      if (msg.includes("account_map_edges") && msg.includes("does not exist")) {
        freeformEdges = { rows: [] as Record<string, unknown>[] };
      } else if (msg.includes("budget_id") && msg.includes("does not exist")) {
        freeformEdges = await client.query(
          `SELECT edge_id, from_type, from_id, to_type, to_id, edge_kind
           FROM account_map_edges
           WHERE ${groupId ? groupAccessClause() : soloUserClause()}`,
          params,
        );
      } else {
        throw err;
      }
    }

    const nodes = [
      ...inventory.rows.map((r) => ({
        id: nodeKey("asset_inventory", Number(r.ai_id)),
        type: "asset_inventory" as const,
        recordId: Number(r.ai_id),
        group: "Estate",
        label: String(r.title || `Asset #${r.ai_id}`),
        subtitle: String(r.asset_classification ?? r.classification_type ?? r.location ?? ""),
        amount: formatMoney(r.value),
      })),
      ...vehicles.rows.map((r) => ({
        id: nodeKey("asset_vehicles", Number(r.vh_id)),
        type: "asset_vehicles" as const,
        recordId: Number(r.vh_id),
        group: "Estate",
        label: [r.year, r.make, r.model].filter(Boolean).join(" ") || `Vehicle #${r.vh_id}`,
        subtitle: r.vin ? `VIN ${r.vin}` : "",
        amount: formatMoney(r.value),
      })),
      ...cash.rows.map((r) => ({
        id: nodeKey("cash_and_investments", Number(r.ci_id)),
        type: "cash_and_investments" as const,
        recordId: Number(r.ci_id),
        group: "Estate",
        label: String(r.institution || `Account #${r.ci_id}`),
        subtitle: String(r.acct_type || r.acct_number || ""),
        amount: formatMoney(r.value),
      })),
      ...debt.rows.map((r) => ({
        id: nodeKey("debt", Number(r.dbt_id)),
        type: "debt" as const,
        recordId: Number(r.dbt_id),
        group: "Estate",
        label: String(r.institution || `Debt #${r.dbt_id}`),
        subtitle: String(r.loan_type || ""),
        amount: formatMoney(r.loan_ammount),
      })),
      ...realEstate.rows.map((r) => ({
        id: nodeKey("real_estate", Number(r.re_id)),
        type: "real_estate" as const,
        recordId: Number(r.re_id),
        group: "Estate",
        label: realEstateLabel(r),
        subtitle: "",
        amount: formatMoney(r.value),
      })),
      ...insurance.rows.map((r) => ({
        id: nodeKey("insurance", Number(r.ins_id)),
        type: "insurance" as const,
        recordId: Number(r.ins_id),
        group: "Estate",
        label: String(r.entity_covered || r.policy_holder || `Policy #${r.ins_id}`),
        subtitle: String(r.polocy_number || ""),
        amount: formatMoney(r.policy_amt),
      })),
      ...income.rows.map((r) => ({
        id: nodeKey("income", Number(r.income_id)),
        type: "income" as const,
        recordId: Number(r.income_id),
        group: "Budget",
        label: [r.income_category, r.sub_category].filter(Boolean).join(" · ") || `Income #${r.income_id}`,
        subtitle: budgetLineTypeLabel("income", r.income_type),
        amount: formatMoney(r.income_category_monthly_amt),
      })),
      ...expenses.rows.map((r) => ({
        id: nodeKey("expense", Number(r.expense_id)),
        type: "expense" as const,
        recordId: Number(r.expense_id),
        group: "Budget",
        label: [r.expense_category, r.sub_category].filter(Boolean).join(" · ") || `Expense #${r.expense_id}`,
        subtitle: budgetLineTypeLabel("expense", r.expense_type),
        amount: formatMoney(r.monthly_budget_amt),
      })),
    ];

    const edges: ResolvedEdge[] = [];

    for (const r of debt.rows) {
      const linkedType = r.linked_asset_type ? String(r.linked_asset_type) : "";
      const linkedId = r.linked_asset_id != null ? Number(r.linked_asset_id) : NaN;
      if (ASSET_LINK_TYPES.includes(linkedType as (typeof ASSET_LINK_TYPES)[number]) && Number.isFinite(linkedId)) {
        const kind: EdgeKind = "secures";
        edges.push({
          id: `fk:debt_link:${r.dbt_id}`,
          source: nodeKey("debt", Number(r.dbt_id)),
          target: nodeKey(linkedType, linkedId),
          edge_kind: kind,
          persistence: "debt_link",
          label: edgeLabel(kind),
        });
      }
    }

    for (const r of income.rows) {
      const ci = r.cash_investment_id != null ? Number(r.cash_investment_id) : NaN;
      if (Number.isFinite(ci) && ci > 0) {
        const kind: EdgeKind = "deposit";
        edges.push({
          id: `fk:income_deposit:${r.income_id}`,
          source: nodeKey("income", Number(r.income_id)),
          target: nodeKey("cash_and_investments", ci),
          edge_kind: kind,
          persistence: "income_deposit",
          label: edgeLabel(kind),
        });
      }
    }

    for (const r of expenses.rows) {
      const dest = r.cash_investment_id != null ? Number(r.cash_investment_id) : NaN;
      if (Number.isFinite(dest) && dest > 0) {
        const kind: EdgeKind = "refund";
        edges.push({
          id: `fk:expense_destination:${r.expense_id}`,
          source: nodeKey("expense", Number(r.expense_id)),
          target: nodeKey("cash_and_investments", dest),
          edge_kind: kind,
          persistence: "expense_destination",
          label: edgeLabel(kind),
        });
      }
      const from = r.from_cash_investment_id != null ? Number(r.from_cash_investment_id) : NaN;
      if (Number.isFinite(from) && from > 0) {
        const kind: EdgeKind = "purchase";
        edges.push({
          id: `fk:expense_source:${r.expense_id}`,
          source: nodeKey("cash_and_investments", from),
          target: nodeKey("expense", Number(r.expense_id)),
          edge_kind: kind,
          persistence: "expense_source",
          label: edgeLabel(kind),
        });
      }
      const debtId = r.debt_id != null ? Number(r.debt_id) : NaN;
      if (Number.isFinite(debtId) && debtId > 0) {
        const kind: EdgeKind = "debt_payment";
        edges.push({
          id: `fk:expense_debt:${r.expense_id}`,
          source: nodeKey("expense", Number(r.expense_id)),
          target: nodeKey("debt", debtId),
          edge_kind: kind,
          persistence: "expense_debt",
          label: edgeLabel(kind),
        });
      }
    }

    for (const r of freeformEdges.rows) {
      const kind = String(r.edge_kind || "transfer") as EdgeKind;
      edges.push({
        id: `ff:${r.edge_id}`,
        source: nodeKey(String(r.from_type), Number(r.from_id)),
        target: nodeKey(String(r.to_type), Number(r.to_id)),
        edge_kind: kind,
        persistence: "freeform",
        freeform_edge_id: Number(r.edge_id),
        label: edgeLabel(kind),
      });
    }

    const layout = layoutRes.rows[0]?.layout_json ?? null;

    return { nodes, edges, layout, budget };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("account-map GET failed", error);
    const detail =
      error && typeof error === "object" && "message" in error
        ? String((error as { message?: string }).message || "")
        : "";
    throw createError({
      statusCode: 500,
      statusMessage: detail
        ? `Failed to load account map: ${detail.slice(0, 180)}`
        : "Failed to load account map.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
