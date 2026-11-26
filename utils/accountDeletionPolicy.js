/**
 * Household rule for account deletion. This is the only place to change it.
 *
 * keep-shared (owner decision, Nov 26, 2026):
 *   Money rows that already belong to a household stay with that household.
 *   A household row is a row in a GROUP_SHARED_TABLES table (server/utils/group.ts)
 *   whose group_id is set, plus the household tax tables below when
 *   REOWN_HOUSEHOLD_TAX is true. Those rows are given to the person who remains.
 *   Rows with no group, and everything private to the person (Faith, Body,
 *   profile, sessions, sign-in), are erased.
 *   A same-name income, investment, or savings source is kept and renamed.
 *   record_shares that name the leaving person are deleted with that person.
 *   When the last person leaves, household rows are deleted, including rows
 *   that still name someone who already left. They are not made private.
 *
 * The server refuses to delete an account if HOUSEHOLD_DELETION_POLICY is not
 * "keep-shared", so a renamed policy cannot silently wipe a household.
 * GROUP_SHARED_TABLES is still the list of shared money tables. Do not add
 * Faith or Body tables there.
 */

export const HOUSEHOLD_DELETION_POLICY = "keep-shared";

/** Household tax profiles and deduction overrides stay with the household. Owner decision, Nov 26, 2026. */
export const REOWN_HOUSEHOLD_TAX = true;

/**
 * match "group_id": re-own where group_id is the household.
 * match "household_key": re-own where household_key is g:<group id>
 * (same key server/utils/group.ts writes).
 */
export const HOUSEHOLD_TAX_TABLES = [
  { table: "tax_household_profiles", match: "group_id" },
  { table: "tax_deduction_overrides", match: "household_key" },
];

/**
 * Unique on (user_id, group, lower(name)). The name column is TEXT, so the
 * table has no declared length. Renames are capped at SOURCE_NAME_MAX_LENGTH
 * so the unique index stays a normal btree key. A colliding leaving copy is
 * kept and renamed. Rows that point at its source_id stay pointed there.
 */
export const REOWN_NAME_COLUMNS = {
  income_sources: "name",
  investment_sources: "name",
  savings_sources: "name",
};

/** First rename of a colliding source. Later collisions add " 2", " 3", and so on. */
export const FORMER_MEMBER_SUFFIX = " (former member)";

/** Application cap for a renamed source. The column itself is unbounded TEXT. */
export const SOURCE_NAME_MAX_LENGTH = 200;

function clipSourceName(original, tail) {
  const room = SOURCE_NAME_MAX_LENGTH - tail.length;
  const head = room > 0 ? String(original).slice(0, room) : "";
  const name = `${head}${tail}`;
  return name.length <= SOURCE_NAME_MAX_LENGTH ? name : name.slice(0, SOURCE_NAME_MAX_LENGTH);
}

/**
 * Name to store when handing a source to the person who remains.
 * `takenNames` are the names that person already has in this household,
 * plus names already assigned to earlier leaving rows in this same pass.
 * The same inputs always return the same name. A name that is not taken is unchanged.
 */
export function renamedSourceName(originalName, takenNames) {
  const original = String(originalName ?? "");
  const taken = new Set((takenNames ?? []).map((name) => String(name).toLowerCase()));
  if (!taken.has(original.toLowerCase())) return original;
  for (let n = 1; n <= 9999; n += 1) {
    const tail = n === 1 ? FORMER_MEMBER_SUFFIX : `${FORMER_MEMBER_SUFFIX} ${n}`;
    const candidate = clipSourceName(original, tail);
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  throw new Error("Could not rename a shared source.");
}

/**
 * When the last person leaves, delete household rows children-first so a
 * foreign key does not abort the deletion. Tables discovered at runtime that
 * are not listed here are deleted after this list and before the group row.
 */
export const DISSOLVE_DELETE_ORDER = [
  "budget_transactions",
  "investment_positions",
  "vehicle_service_records",
  "account_map_edges",
  "account_map_layouts",
  "tax_annual_totals",
  "fiscal_annual_totals",
  "budget_month_assignments",
  "income",
  "expenses",
  "income_sources",
  "investment_sources",
  "savings_sources",
  "estate_documents",
  "estate_entries",
  "asset_inventory",
  "asset_vehicles",
  "cash_and_investments",
  "debt",
  "insurance",
  "real_estate",
  "budgets",
  "tax_household_profiles",
];

export function householdKeyForGroup(groupId) {
  return `g:${Number(groupId)}`;
}

/** Bearer tokens older than this are not a fresh sign-in for Supabase-only deletion. */
export const REAUTH_WINDOW_MS = 5 * 60 * 1000;

export const DELETION_ATTEMPT_USER_LIMIT = 5;
export const DELETION_ATTEMPT_IP_LIMIT = 30;

export function isSafeIdentifier(name) {
  return typeof name === "string" && /^[a-z_][a-z0-9_]*$/.test(name);
}
