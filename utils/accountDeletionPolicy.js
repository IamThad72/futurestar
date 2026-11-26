/**
 * Household rule for account deletion. This is the only place to change it.
 *
 * keep-shared (default, waiting on the owner):
 *   Money rows that already belong to a household stay with that household.
 *   A household row is a row in a GROUP_SHARED_TABLES table (server/utils/group.ts)
 *   whose group_id is set, plus the household tax tables below when
 *   REOWN_HOUSEHOLD_TAX is true. Those rows are given to the person who remains.
 *   Rows with no group, and everything private to the person (Faith, Body,
 *   profile, sessions, sign-in), are erased.
 *
 * The server refuses to delete an account if HOUSEHOLD_DELETION_POLICY is not
 * "keep-shared", so a renamed policy cannot silently wipe a household.
 * GROUP_SHARED_TABLES is still the list of shared money tables. Do not add
 * Faith or Body tables there.
 */

export const HOUSEHOLD_DELETION_POLICY = "keep-shared";

/** Also hand household tax rows to the person who remains. They are money records, but they are not in GROUP_SHARED_TABLES. */
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
 * Unique on (user_id, group, lower(name)). A shared name stays with the
 * person who remains; the leaving copy is erased with their account.
 * Linked transactions use ON DELETE SET NULL, so they keep the remaining source.
 */
export const REOWN_NAME_COLUMNS = {
  income_sources: "name",
  investment_sources: "name",
  savings_sources: "name",
};

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

export function isSafeIdentifier(name) {
  return typeof name === "string" && /^[a-z_][a-z0-9_]*$/.test(name);
}
