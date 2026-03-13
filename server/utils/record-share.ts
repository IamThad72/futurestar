import { createError } from "h3";

const recordTypeMap = {
  asset_inventory: {
    table: "asset_inventory",
    idColumn: "ai_id",
    ownerColumn: "user_id",
  },
  asset_vehicles: {
    table: "asset_vehicles",
    idColumn: "vh_id",
    ownerColumn: "user_id",
  },
  cash_and_investments: {
    table: "cash_and_investments",
    idColumn: "ci_id",
    ownerColumn: "user_id",
  },
  debt: {
    table: "debt",
    idColumn: "dbt_id",
    ownerColumn: "user_id",
  },
  insurance: {
    table: "insurance",
    idColumn: "ins_id",
    ownerColumn: "user_id",
  },
  real_estate: {
    table: "real_estate",
    idColumn: "re_id",
    ownerColumn: "user_id",
  },
};

export type RecordType = keyof typeof recordTypeMap;

export const getRecordTypeConfig = (recordType: string) => {
  if (!(recordType in recordTypeMap)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Unsupported record type.",
    });
  }
  return recordTypeMap[recordType as RecordType];
};

export const assertOwner = async (
  client: { query: (queryText: string, values: unknown[]) => Promise<{ rows: Array<{ user_id?: number }> }> },
  recordType: string,
  recordId: number,
  userId: number,
) => {
  const config = getRecordTypeConfig(recordType);
  const result = await client.query(
    `SELECT ${config.ownerColumn} AS user_id
     FROM ${config.table}
     WHERE ${config.idColumn} = $1`,
    [recordId],
  );

  const ownerId = result.rows[0]?.user_id;
  if (!ownerId || ownerId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: "You do not have permission to share this record.",
    });
  }
};

export const hasShareAccess = async (
  client: { query: (queryText: string, values: unknown[]) => Promise<{ rows: Array<{ role?: string }> }> },
  recordType: string,
  recordId: number,
  userId: number,
  requiredRole: "viewer" | "editor" = "viewer",
) => {
  const roles = requiredRole === "editor" ? ["editor"] : ["viewer", "editor"];
  const result = await client.query(
    `SELECT role
     FROM record_shares
     WHERE record_type = $1 AND record_id = $2 AND shared_user_id = $3`,
    [recordType, recordId, userId],
  );

  const role = result.rows[0]?.role;
  return role ? roles.includes(role) : false;
};
