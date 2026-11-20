import { createError } from "h3";
import { isMissingRelationError } from "~/utils/tax/dbErrors.js";
import { deductionTypeByKey, LOCAL_WAGE_RULES } from "~/utils/tax/deductions.js";
import { normalizeTaxProfile, stateName } from "~/utils/tax/profile.js";
import { annualTotalsHouseholdKey } from "./taxAnnualTotals";

type DbClient = {
  query: (queryText: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
};

export type TaxHouseholdProfileRow = {
  filing_status: string;
  state_code: string;
  children_under_17: number;
  other_dependents: number;
  deduction_method: string;
  itemized_deduction: number;
  local_jurisdiction: string | null;
  local_county: string | null;
  local_zip: string | null;
  school_district: string | null;
  city_rate: number;
  school_district_rate: number;
  local_wage_rule: string | null;
  paychecks_per_year: number | null;
};

const PROFILE_COLUMNS = `
  filing_status, state_code, children_under_17, other_dependents, deduction_method,
  itemized_deduction, local_jurisdiction, local_county, local_zip, school_district,
  city_rate, school_district_rate, local_wage_rule, paychecks_per_year
`;

function mapProfile(row: Record<string, unknown> | undefined): TaxHouseholdProfileRow | null {
  if (!row) return null;
  return {
    filing_status: String(row.filing_status),
    state_code: String(row.state_code),
    children_under_17: Number(row.children_under_17) || 0,
    other_dependents: Number(row.other_dependents) || 0,
    deduction_method: String(row.deduction_method),
    itemized_deduction: Number(row.itemized_deduction) || 0,
    local_jurisdiction: row.local_jurisdiction != null ? String(row.local_jurisdiction) : null,
    local_county: row.local_county != null ? String(row.local_county) : null,
    local_zip: row.local_zip != null ? String(row.local_zip) : null,
    school_district: row.school_district != null ? String(row.school_district) : null,
    city_rate: Number(row.city_rate) || 0,
    school_district_rate: Number(row.school_district_rate) || 0,
    local_wage_rule: row.local_wage_rule != null ? String(row.local_wage_rule) : null,
    paychecks_per_year: row.paychecks_per_year == null ? null : Number(row.paychecks_per_year),
  };
}

export function taxProfileUnavailable(error: unknown) {
  return isMissingRelationError(error, "tax_household_profiles") || isMissingRelationError(error, "tax_deduction_overrides");
}

export async function readTaxHouseholdProfile(
  client: DbClient,
  userId: number,
  groupId: number | null,
  taxYear: number,
) {
  const householdKey = annualTotalsHouseholdKey(userId, groupId);
  const result = await client.query(
    `SELECT ${PROFILE_COLUMNS}
     FROM tax_household_profiles
     WHERE household_key = $1 AND tax_year = $2`,
    [householdKey, taxYear],
  );
  return {
    householdKey,
    profile: mapProfile(result.rows[0]),
  };
}

export function profileFromBody(body: Record<string, unknown>) {
  const normalized = normalizeTaxProfile(body);
  if (!normalized) {
    throw createError({ statusCode: 400, statusMessage: "Choose a filing status." });
  }
  if (!stateName(normalized.stateCode)) {
    throw createError({ statusCode: 400, statusMessage: "Choose a state." });
  }
  if (normalized.localWageRule && !LOCAL_WAGE_RULES.some((rule) => rule.id === normalized.localWageRule)) {
    throw createError({ statusCode: 400, statusMessage: "Unknown local wage rule." });
  }
  return normalized;
}

export async function saveTaxHouseholdProfile(
  client: DbClient,
  userId: number,
  groupId: number | null,
  taxYear: number,
  body: Record<string, unknown>,
) {
  const profile = profileFromBody(body);
  const householdKey = annualTotalsHouseholdKey(userId, groupId);
  const result = await client.query(
    `INSERT INTO tax_household_profiles (
       user_id, group_id, household_key, tax_year,
       filing_status, state_code, children_under_17, other_dependents,
       deduction_method, itemized_deduction,
       local_jurisdiction, local_county, local_zip, school_district,
       city_rate, school_district_rate, local_wage_rule, paychecks_per_year, updated_at
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, $8,
       $9, $10,
       $11, $12, $13, $14,
       $15, $16, $17, $18, NOW()
     )
     ON CONFLICT (household_key, tax_year) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       group_id = EXCLUDED.group_id,
       filing_status = EXCLUDED.filing_status,
       state_code = EXCLUDED.state_code,
       children_under_17 = EXCLUDED.children_under_17,
       other_dependents = EXCLUDED.other_dependents,
       deduction_method = EXCLUDED.deduction_method,
       itemized_deduction = EXCLUDED.itemized_deduction,
       local_jurisdiction = EXCLUDED.local_jurisdiction,
       local_county = EXCLUDED.local_county,
       local_zip = EXCLUDED.local_zip,
       school_district = EXCLUDED.school_district,
       city_rate = EXCLUDED.city_rate,
       school_district_rate = EXCLUDED.school_district_rate,
       local_wage_rule = EXCLUDED.local_wage_rule,
       paychecks_per_year = EXCLUDED.paychecks_per_year,
       updated_at = NOW()
     RETURNING ${PROFILE_COLUMNS}`,
    [
      userId,
      groupId,
      householdKey,
      taxYear,
      profile.filingStatus,
      profile.stateCode,
      profile.childrenUnder17,
      profile.otherDependents,
      profile.deductionMethod,
      profile.itemizedDeduction,
      profile.localJurisdiction || null,
      profile.localCounty || null,
      profile.localZip || null,
      profile.schoolDistrict || null,
      profile.cityRate,
      profile.schoolDistrictRate,
      profile.localWageRule,
      profile.paychecksPerYear,
    ],
  );
  return { householdKey, profile: mapProfile(result.rows[0]) };
}

export async function listTaxDeductionOverrides(client: DbClient, userId: number, groupId: number | null) {
  const householdKey = annualTotalsHouseholdKey(userId, groupId);
  const found = await client.query(`SELECT to_regclass('public.tax_deduction_overrides') AS rel`);
  if (!found.rows[0]?.rel) return { householdKey, overrides: [], unavailable: true };
  const result = await client.query(
    `SELECT category, sub_category, deduction_key
     FROM tax_deduction_overrides
     WHERE household_key = $1
     ORDER BY category, sub_category`,
    [householdKey],
  );
  return { householdKey, overrides: result.rows, unavailable: false };
}

export async function saveTaxDeductionOverride(
  client: DbClient,
  userId: number,
  groupId: number | null,
  body: Record<string, unknown>,
) {
  const category = String(body.category ?? "").trim();
  const subCategory = String(body.sub_category ?? body.subCategory ?? "").trim();
  const deductionKey = String(body.deduction_key ?? body.deductionKey ?? "").trim();
  if (!category) {
    throw createError({ statusCode: 400, statusMessage: "Category is required." });
  }
  const householdKey = annualTotalsHouseholdKey(userId, groupId);
  if (!deductionKey) {
    await client.query(
      `DELETE FROM tax_deduction_overrides
       WHERE household_key = $1 AND category = $2 AND sub_category = $3`,
      [householdKey, category, subCategory],
    );
    return { householdKey, removed: true };
  }
  if (deductionKey !== "ignore" && !deductionTypeByKey(deductionKey)) {
    throw createError({ statusCode: 400, statusMessage: "Unknown deduction type." });
  }
  await client.query(
    `INSERT INTO tax_deduction_overrides (user_id, household_key, category, sub_category, deduction_key, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (household_key, category, sub_category) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       deduction_key = EXCLUDED.deduction_key,
       updated_at = NOW()`,
    [userId, householdKey, category, subCategory, deductionKey],
  );
  return { householdKey, removed: false, category, sub_category: subCategory, deduction_key: deductionKey };
}
