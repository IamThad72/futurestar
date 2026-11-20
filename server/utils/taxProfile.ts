import { createError } from "h3";
import { getActiveBudget } from "./budgetAccess";
import { getUserGroupId, groupAccessClause, soloUserClause } from "./group";
import { emptyBudgetIncome, summarizeBudgetIncome } from "~/utils/tax/budgetIncome.js";
import { FILING_STATUSES, stateName } from "~/utils/tax/profile.js";

type DbClient = {
  query: (queryText: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};

export type TaxProfileRow = {
  tax_profile_id: number | null;
  user_id: number;
  filing_status: string;
  state_code: string;
  local_jurisdiction: string;
  local_zip: string;
  local_rate: number | null;
  children_under_17: number;
  other_dependents: number;
  deduction_method: string;
  itemized_deduction: number;
  wages: number | null;
  self_employment: number | null;
  retirement: number | null;
  other_income: number | null;
  use_budget_income: boolean;
  saved: boolean;
};

const DEFAULT_PROFILE = {
  filing_status: "single",
  state_code: "",
  local_jurisdiction: "",
  local_zip: "",
  local_rate: null,
  children_under_17: 0,
  other_dependents: 0,
  deduction_method: "standard",
  itemized_deduction: 0,
  wages: null,
  self_employment: null,
  retirement: null,
  other_income: null,
  use_budget_income: true,
};

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function num(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function profileFromRow(row: Record<string, unknown> | null | undefined, userId: number): TaxProfileRow {
  const source = row || {};
  return {
    tax_profile_id: source.tax_profile_id != null ? Number(source.tax_profile_id) : null,
    user_id: userId,
    filing_status: String(source.filing_status || DEFAULT_PROFILE.filing_status),
    state_code: String(source.state_code || ""),
    local_jurisdiction: String(source.local_jurisdiction || ""),
    local_zip: String(source.local_zip || ""),
    local_rate: source.local_rate == null || source.local_rate === "" ? null : num(source.local_rate),
    children_under_17: Math.trunc(num(source.children_under_17)),
    other_dependents: Math.trunc(num(source.other_dependents)),
    deduction_method: String(source.deduction_method || "standard"),
    itemized_deduction: num(source.itemized_deduction),
    wages: numOrNull(source.wages),
    self_employment: numOrNull(source.self_employment),
    retirement: numOrNull(source.retirement),
    other_income: numOrNull(source.other_income),
    use_budget_income: source.use_budget_income == null ? true : Boolean(source.use_budget_income),
    saved: Boolean(row),
  };
}

export function resolveIncome(profile: TaxProfileRow, budgetIncome: ReturnType<typeof emptyBudgetIncome>) {
  if (profile.use_budget_income) {
    return {
      wages: budgetIncome.wages,
      self_employment: budgetIncome.self_employment,
      retirement: budgetIncome.retirement,
      other_income: budgetIncome.other_income,
      source: "budget" as const,
    };
  }
  return {
    wages: profile.wages ?? 0,
    self_employment: profile.self_employment ?? 0,
    retirement: profile.retirement ?? 0,
    other_income: profile.other_income ?? 0,
    source: "profile" as const,
  };
}

function isMissingTable(error: unknown) {
  const message = String((error as { message?: string })?.message || error || "");
  return message.includes("tax_profiles") && message.includes("does not exist");
}

export async function loadBudgetIncome(client: DbClient, userId: number) {
  const groupId = await getUserGroupId(client, userId);
  const budget = await getActiveBudget(client, userId, groupId);
  const ownerAccess = groupId ? groupAccessClause() : soloUserClause();
  const budgetParam = groupId ? "$3" : "$2";
  const params = groupId ? [userId, groupId, budget.budget_id] : [userId, budget.budget_id];
  const result = await client.query(
    `SELECT COALESCE(income_type, 'gross') AS income_type,
            income_category AS category,
            sub_category,
            income_category_desc AS description,
            income_category_monthly_amt AS monthly_amount,
            income_category_annual_amt AS annual_amount
     FROM income
     WHERE ${ownerAccess} AND budget_id = ${budgetParam}`,
    params,
  );
  return {
    budget_id: budget.budget_id,
    ...summarizeBudgetIncome(result.rows),
  };
}

export async function loadTaxProfile(client: DbClient, userId: number) {
  let row: Record<string, unknown> | null = null;
  try {
    const result = await client.query(
      `SELECT tax_profile_id, user_id, filing_status, state_code, local_jurisdiction, local_zip,
              local_rate, children_under_17, other_dependents, deduction_method, itemized_deduction,
              wages, self_employment, retirement, other_income, use_budget_income
       FROM tax_profiles
       WHERE user_id = $1`,
      [userId],
    );
    row = result.rows[0] || null;
  } catch (error) {
    if (isMissingTable(error)) {
      throw createError({
        statusCode: 500,
        statusMessage: "Tax profiles are not set up yet. Run scripts/create_tax_profiles.sql in Supabase.",
      });
    }
    throw error;
  }
  const profile = profileFromRow(row, userId);
  const budgetIncome = await loadBudgetIncome(client, userId);
  const income = resolveIncome(profile, budgetIncome);
  return { profile, budget_income: budgetIncome, income };
}

function requireString(body: Record<string, unknown>, key: string) {
  return body?.[key] != null ? String(body[key]).trim() : "";
}

export function parseTaxProfileBody(body: Record<string, unknown>) {
  const filing = requireString(body, "filing_status");
  if (!FILING_STATUSES.includes(filing)) {
    throw createError({ statusCode: 400, statusMessage: "Choose a filing status." });
  }
  const state = requireString(body, "state_code").toUpperCase();
  if (state && !stateName(state)) {
    throw createError({ statusCode: 400, statusMessage: "Choose a state." });
  }
  const method = requireString(body, "deduction_method") || "standard";
  if (method !== "standard" && method !== "itemized") {
    throw createError({ statusCode: 400, statusMessage: "Deduction must be standard or itemized." });
  }
  const children = Math.trunc(Number(body.children_under_17 ?? 0));
  const others = Math.trunc(Number(body.other_dependents ?? 0));
  if (!Number.isFinite(children) || children < 0 || children > 20 || !Number.isFinite(others) || others < 0 || others > 20) {
    throw createError({ statusCode: 400, statusMessage: "Dependent counts must be between 0 and 20." });
  }
  const zip = requireString(body, "local_zip");
  if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) {
    throw createError({ statusCode: 400, statusMessage: "ZIP must be 5 digits, or 5+4." });
  }
  let localRate: number | null = null;
  if (body.local_rate != null && body.local_rate !== "") {
    localRate = Number(body.local_rate);
    if (!Number.isFinite(localRate) || localRate < 0 || localRate > 0.15) {
      throw createError({ statusCode: 400, statusMessage: "Local rate must be between 0% and 15%." });
    }
  }
  const itemized = Number(body.itemized_deduction ?? 0);
  if (!Number.isFinite(itemized) || itemized < 0) {
    throw createError({ statusCode: 400, statusMessage: "Itemized deduction must be zero or more." });
  }
  const amounts = ["wages", "self_employment", "retirement", "other_income"] as const;
  const parsedAmounts: Record<(typeof amounts)[number], number | null> = {
    wages: null,
    self_employment: null,
    retirement: null,
    other_income: null,
  };
  for (const key of amounts) {
    if (body[key] == null || body[key] === "") continue;
    const value = Number(body[key]);
    if (!Number.isFinite(value) || value < 0) {
      throw createError({ statusCode: 400, statusMessage: "Income amounts must be zero or more." });
    }
    parsedAmounts[key] = Math.round(value * 100) / 100;
  }
  return {
    filing_status: filing,
    state_code: state,
    local_jurisdiction: requireString(body, "local_jurisdiction").slice(0, 120),
    local_zip: zip,
    local_rate: localRate,
    children_under_17: children,
    other_dependents: others,
    deduction_method: method,
    itemized_deduction: Math.round(itemized * 100) / 100,
    ...parsedAmounts,
    use_budget_income: Boolean(body.use_budget_income),
  };
}

export async function saveTaxProfile(client: DbClient, userId: number, body: Record<string, unknown>) {
  const parsed = parseTaxProfileBody(body);
  try {
    await client.query(
      `INSERT INTO tax_profiles (
         user_id, filing_status, state_code, local_jurisdiction, local_zip, local_rate,
         children_under_17, other_dependents, deduction_method, itemized_deduction,
         wages, self_employment, retirement, other_income, use_budget_income, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10,
         $11, $12, $13, $14, $15, NOW()
       )
       ON CONFLICT (user_id) DO UPDATE SET
         filing_status = EXCLUDED.filing_status,
         state_code = EXCLUDED.state_code,
         local_jurisdiction = EXCLUDED.local_jurisdiction,
         local_zip = EXCLUDED.local_zip,
         local_rate = EXCLUDED.local_rate,
         children_under_17 = EXCLUDED.children_under_17,
         other_dependents = EXCLUDED.other_dependents,
         deduction_method = EXCLUDED.deduction_method,
         itemized_deduction = EXCLUDED.itemized_deduction,
         wages = EXCLUDED.wages,
         self_employment = EXCLUDED.self_employment,
         retirement = EXCLUDED.retirement,
         other_income = EXCLUDED.other_income,
         use_budget_income = EXCLUDED.use_budget_income,
         updated_at = NOW()`,
      [
        userId,
        parsed.filing_status,
        parsed.state_code,
        parsed.local_jurisdiction || null,
        parsed.local_zip || null,
        parsed.local_rate,
        parsed.children_under_17,
        parsed.other_dependents,
        parsed.deduction_method,
        parsed.itemized_deduction,
        parsed.wages,
        parsed.self_employment,
        parsed.retirement,
        parsed.other_income,
        parsed.use_budget_income,
      ],
    );
  } catch (error) {
    if (isMissingTable(error)) {
      throw createError({
        statusCode: 500,
        statusMessage: "Tax profiles are not set up yet. Run scripts/create_tax_profiles.sql in Supabase.",
      });
    }
    throw error;
  }
  return loadTaxProfile(client, userId);
}
