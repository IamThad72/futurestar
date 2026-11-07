import { createError } from "h3";
import { marketValueAfterEdit } from "~/utils/investmentPerformance.js";
import { getUserGroupId, groupAccessClauseAt, soloUserClauseAt } from "./group";

type DbClient = {
  query: (queryText: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number }>;
};

type PositionInput = {
  name?: unknown;
  ticker?: unknown;
  account?: unknown;
  accountId?: unknown;
  shares?: unknown;
  price?: unknown;
  costBasis?: unknown;
  currentValue?: unknown;
};

const ACCOUNT_ALIASES: Record<string, string> = {
  "hsa cash": "HSA - Cash",
  "hsa - cash": "HSA - Cash",
  "hsa investments": "HSA - Investments",
  "hsa - investments": "HSA - Investments",
};

export function amountOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function accountName(value: unknown): string {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  return ACCOUNT_ALIASES[text.toLowerCase()] || text;
}

export function mapPosition(row: Record<string, unknown>) {
  return {
    id: Number(row.position_id),
    accountId: Number(row.ci_id),
    name: String(row.description || ""),
    ticker: String(row.symbol || ""),
    account: String(row.institution || ""),
    shares: amountOrNull(row.shares),
    price: amountOrNull(row.price),
    priceAsOf: row.price_as_of ? String(row.price_as_of).slice(0, 10) : null,
    costBasis: amountOrNull(row.cost_basis),
    currentValue: amountOrNull(row.market_value),
  };
}

const POSITION_SELECT = `
  SELECT p.position_id, p.ci_id, p.symbol, p.description, p.shares, p.price, p.price_as_of,
         p.cost_basis, p.market_value, ci.institution
  FROM investment_positions p
  JOIN cash_and_investments ci ON ci.ci_id = p.ci_id
`;

export async function listPositions(client: DbClient, userId: number) {
  const groupId = await getUserGroupId(client, userId);
  const access = groupId ? groupAccessClause("ci") : soloUserClause("ci");
  const params = groupId ? [userId, groupId] : [userId];
  const result = await client.query(
    `${POSITION_SELECT} WHERE ${access} ORDER BY p.sort_order, p.position_id`,
    params,
  );
  return result.rows.map(mapPosition);
}

async function findAccount(client: DbClient, userId: number, institution: string, accountId: number | null) {
  const groupId = await getUserGroupId(client, userId);
  if (accountId != null) {
    const access = groupId ? groupAccessClauseAt("ci", 2, 3) : soloUserClauseAt("ci", 2);
    const params = groupId ? [accountId, userId, groupId] : [accountId, userId];
    const byId = await client.query(
      `SELECT ci.ci_id, ci.user_id, ci.group_id, ci.institution
       FROM cash_and_investments ci
       WHERE ci.ci_id = $1 AND ${access}
       LIMIT 1`,
      params,
    );
    if (byId.rows[0]) return byId.rows[0];
  }
  if (!institution) return null;
  const access = groupId ? groupAccessClauseAt("ci", 2, 3) : soloUserClauseAt("ci", 2);
  const params = groupId ? [institution, userId, groupId] : [institution, userId];
  const result = await client.query(
    `SELECT ci.ci_id, ci.user_id, ci.group_id, ci.institution
     FROM cash_and_investments ci
     WHERE ci.institution = $1 AND ${access}
     ORDER BY ci.ci_id
     LIMIT 1`,
    params,
  );
  return result.rows[0] ?? null;
}

function accessForAccount(groupId: number | null) {
  return groupId ? groupAccessClauseAt("ci", 1, 2) : soloUserClauseAt("ci", 1);
}

async function syncAccountValue(client: DbClient, accountId: number) {
  await client.query(
    `UPDATE cash_and_investments ci
     SET value = s.total::numeric::money
     FROM (
       SELECT ci_id, ROUND(SUM(market_value), 2) AS total
       FROM investment_positions
       WHERE ci_id = $1
       GROUP BY ci_id
     ) s
     WHERE ci.ci_id = s.ci_id AND s.total IS NOT NULL`,
    [accountId],
  );
}

async function applySharedPrice(client: DbClient, userId: number, symbol: string, price: number, exceptId: number | null) {
  const groupId = await getUserGroupId(client, userId);
  const access = groupId ? groupAccessClauseAt("ci", 3, 4) : soloUserClauseAt("ci", 3);
  const params = groupId ? [price, symbol, userId, groupId] : [price, symbol, userId];
  const except = exceptId == null ? "" : ` AND p.position_id <> $${params.length + 1}`;
  if (exceptId != null) params.push(exceptId);
  await client.query(
    `UPDATE investment_positions p
     SET price = $1,
         price_as_of = CURRENT_DATE,
         market_value = CASE WHEN p.shares IS NOT NULL THEN ROUND(p.shares * $1, 2) ELSE p.market_value END,
         updated_at = NOW()
     FROM cash_and_investments ci
     WHERE p.ci_id = ci.ci_id
       AND p.symbol = $2
       AND ${access}
       ${except}`,
    params,
  );
  const accounts = await client.query(
    `SELECT DISTINCT p.ci_id
     FROM investment_positions p
     JOIN cash_and_investments ci ON ci.ci_id = p.ci_id
     WHERE p.symbol = $1 AND ${groupId ? groupAccessClauseAt("ci", 2, 3) : soloUserClauseAt("ci", 2)}`,
    groupId ? [symbol, userId, groupId] : [symbol, userId],
  );
  for (const row of accounts.rows) {
    await syncAccountValue(client, Number(row.ci_id));
  }
}

function readDraft(body: PositionInput) {
  const name = String(body?.name ?? "").trim();
  const ticker = String(body?.ticker ?? "").trim();
  const account = accountName(body?.account);
  const accountIdRaw = Number(body?.accountId);
  const accountId = Number.isInteger(accountIdRaw) && accountIdRaw > 0 ? accountIdRaw : null;
  if (!name || !ticker || (!account && accountId == null)) {
    throw createError({ statusCode: 400, statusMessage: "Name, symbol, and account are required." });
  }
  const shares = amountOrNull(body?.shares);
  const price = amountOrNull(body?.price);
  const costBasis = amountOrNull(body?.costBasis);
  const currentValue = amountOrNull(body?.currentValue);
  for (const [label, value] of [
    ["Shares", shares],
    ["Price", price],
    ["Cost basis", costBasis],
    ["Current value", currentValue],
  ] as const) {
    if (value != null && value < 0) {
      throw createError({ statusCode: 400, statusMessage: `${label} cannot be negative.` });
    }
  }
  return { name, ticker, account, accountId, shares, price, costBasis, currentValue };
}

export async function createPosition(client: DbClient, userId: number, body: PositionInput) {
  const draft = readDraft(body);
  const account = await findAccount(client, userId, draft.account, draft.accountId);
  if (!account) {
    throw createError({ statusCode: 400, statusMessage: "Choose an Estate cash or investment account." });
  }
  const marketValue = marketValueAfterEdit(null, draft);
  const inserted = await client.query(
    `INSERT INTO investment_positions
      (ci_id, user_id, group_id, symbol, description, shares, price, price_as_of, cost_basis, market_value, sort_order)
     VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       CASE WHEN $7::numeric IS NULL THEN NULL ELSE CURRENT_DATE END,
       $8, $9,
       COALESCE((SELECT MAX(sort_order) + 1 FROM investment_positions WHERE ci_id = $1), 0)
     )
     RETURNING position_id`,
    [
      account.ci_id,
      account.user_id,
      account.group_id,
      draft.ticker,
      draft.name,
      draft.shares,
      draft.price,
      draft.costBasis,
      marketValue,
    ],
  );
  const id = Number(inserted.rows[0].position_id);
  if (draft.price != null) await applySharedPrice(client, userId, draft.ticker, draft.price, id);
  await syncAccountValue(client, Number(account.ci_id));
  const row = await client.query(`${POSITION_SELECT} WHERE p.position_id = $1`, [id]);
  return mapPosition(row.rows[0]);
}

export async function updatePosition(client: DbClient, userId: number, positionId: number, body: PositionInput) {
  const groupId = await getUserGroupId(client, userId);
  const access = accessForAccount(groupId);
  const params = groupId ? [userId, groupId, positionId] : [userId, positionId];
  const existingResult = await client.query(
    `${POSITION_SELECT} WHERE ${access} AND p.position_id = $${params.length}`,
    params,
  );
  const existing = existingResult.rows[0];
  if (!existing) throw createError({ statusCode: 404, statusMessage: "Holding not found." });

  const draft = readDraft(body);
  const account = await findAccount(client, userId, draft.account, draft.accountId);
  if (!account) {
    throw createError({ statusCode: 400, statusMessage: "Choose an Estate cash or investment account." });
  }
  const previous = mapPosition(existing);
  const marketValue = marketValueAfterEdit(previous, draft);
  const priceChanged = previous.price !== draft.price;
  await client.query(
    `UPDATE investment_positions
     SET ci_id = $1,
         symbol = $2,
         description = $3,
         shares = $4,
         price = $5,
         price_as_of = CASE WHEN $5::numeric IS NULL THEN NULL WHEN $6::boolean THEN CURRENT_DATE ELSE price_as_of END,
         cost_basis = $7,
         market_value = $8,
         updated_at = NOW()
     WHERE position_id = $9`,
    [account.ci_id, draft.ticker, draft.name, draft.shares, draft.price, priceChanged, draft.costBasis, marketValue, positionId],
  );
  if (priceChanged && draft.price != null) await applySharedPrice(client, userId, draft.ticker, draft.price, positionId);
  await syncAccountValue(client, Number(existing.ci_id));
  if (Number(existing.ci_id) !== Number(account.ci_id)) await syncAccountValue(client, Number(account.ci_id));
  const row = await client.query(`${POSITION_SELECT} WHERE p.position_id = $1`, [positionId]);
  return mapPosition(row.rows[0]);
}

export async function deletePosition(client: DbClient, userId: number, positionId: number) {
  const groupId = await getUserGroupId(client, userId);
  const access = accessForAccount(groupId);
  const params = groupId ? [userId, groupId, positionId] : [userId, positionId];
  const existing = await client.query(
    `SELECT p.ci_id
     FROM investment_positions p
     JOIN cash_and_investments ci ON ci.ci_id = p.ci_id
     WHERE ${access} AND p.position_id = $${params.length}`,
    params,
  );
  if (!existing.rows[0]) throw createError({ statusCode: 404, statusMessage: "Holding not found." });
  const accountId = Number(existing.rows[0].ci_id);
  await client.query(`DELETE FROM investment_positions WHERE position_id = $1`, [positionId]);
  await syncAccountValue(client, accountId);
}
