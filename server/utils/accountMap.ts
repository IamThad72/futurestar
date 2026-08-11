export const NODE_TYPES = [
  "asset_inventory",
  "asset_vehicles",
  "cash_and_investments",
  "debt",
  "real_estate",
  "insurance",
  "income",
  "expense",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const EDGE_KINDS = ["flow", "deposit", "transfer", "secures", "purchase", "refund", "debt_payment"] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

export const ASSET_LINK_TYPES = [
  "asset_inventory",
  "asset_vehicles",
  "cash_and_investments",
  "real_estate",
  "insurance",
] as const;

export function nodeKey(type: string, id: number | string) {
  return `${type}:${id}`;
}

export function parseNodeKey(key: string): { type: NodeType; id: number } | null {
  const [type, idStr] = String(key || "").split(":");
  const id = Number(idStr);
  if (!NODE_TYPES.includes(type as NodeType) || !Number.isFinite(id) || id <= 0) return null;
  return { type: type as NodeType, id };
}

export function isNodeType(value: unknown): value is NodeType {
  return typeof value === "string" && NODE_TYPES.includes(value as NodeType);
}

export function isEdgeKind(value: unknown): value is EdgeKind {
  return typeof value === "string" && EDGE_KINDS.includes(value as EdgeKind);
}

/** Display labels for budget line types (matches Budget Setup wording). */
export function budgetLineTypeLabel(kind: "income" | "expense", rawType: unknown): string {
  const t = String(rawType || "").trim().toLowerCase();
  if (kind === "income") {
    switch (t) {
      case "tax":
        return "Tax";
      case "deduction":
        return "Insurance";
      case "interest":
        return "Interest";
      case "other":
        return "Other";
      case "gross":
      default:
        return "Income";
    }
  }
  switch (t) {
    case "savings":
      return "Savings";
    case "investment":
      return "Investments";
    case "expense":
    default:
      return "Expense";
  }
}

/** Infer default edge kind from endpoint types. */
export function defaultEdgeKind(fromType: NodeType, toType: NodeType): EdgeKind {
  if (fromType === "debt" && ASSET_LINK_TYPES.includes(toType as (typeof ASSET_LINK_TYPES)[number])) {
    return "secures";
  }
  if (fromType === "income" && toType === "cash_and_investments") return "deposit";
  if (fromType === "income" && toType === "expense") return "flow";
  if (fromType === "expense" && toType === "cash_and_investments") return "refund";
  if (fromType === "cash_and_investments" && toType === "expense") return "purchase";
  if (fromType === "cash_and_investments" && toType === "cash_and_investments") return "transfer";
  if (fromType === "expense" && toType === "debt") return "debt_payment";
  if (fromType === "cash_and_investments" && toType === "debt") return "debt_payment";
  return "transfer";
}

export function edgeLabel(kind: EdgeKind) {
  switch (kind) {
    case "flow":
      return "flow";
    case "deposit":
      return "deposit";
    case "transfer":
      return "transfer";
    case "secures":
      return "secures";
    case "purchase":
      return "purchase";
    case "refund":
      return "refund";
    case "debt_payment":
      return "debt payment";
    default:
      return "transfer";
  }
}

export type ResolvedEdge = {
  id: string;
  source: string;
  target: string;
  edge_kind: EdgeKind;
  persistence: "debt_link" | "income_deposit" | "expense_destination" | "expense_source" | "expense_debt" | "freeform";
  freeform_edge_id?: number;
  label: string;
};

/**
 * Classify how an edge should be stored.
 */
export function classifyEdgePersistence(
  fromType: NodeType,
  toType: NodeType,
  edgeKind: EdgeKind,
): ResolvedEdge["persistence"] | null {
  if (fromType === "debt" && ASSET_LINK_TYPES.includes(toType as (typeof ASSET_LINK_TYPES)[number]) && edgeKind === "secures") {
    return "debt_link";
  }
  if (fromType === "income" && toType === "cash_and_investments" && (edgeKind === "deposit" || edgeKind === "flow")) {
    return "income_deposit";
  }
  if (fromType === "expense" && toType === "cash_and_investments" && (edgeKind === "refund" || edgeKind === "deposit" || edgeKind === "flow")) {
    return "expense_destination";
  }
  if (fromType === "cash_and_investments" && toType === "expense" && (edgeKind === "purchase" || edgeKind === "flow")) {
    return "expense_source";
  }
  if (fromType === "expense" && toType === "debt" && edgeKind === "debt_payment") {
    return "expense_debt";
  }
  if (
    edgeKind === "flow" ||
    edgeKind === "deposit" ||
    edgeKind === "transfer" ||
    edgeKind === "purchase" ||
    edgeKind === "refund" ||
    edgeKind === "debt_payment"
  ) {
    return "freeform";
  }
  return null;
}
