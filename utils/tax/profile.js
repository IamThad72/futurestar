export const FILING_STATUSES = [
  "single",
  "married_filing_jointly",
  "married_filing_separately",
  "head_of_household",
  "qualifying_surviving_spouse",
];

export const FILING_STATUS_LABELS = {
  single: "Single",
  married_filing_jointly: "Married filing jointly",
  married_filing_separately: "Married filing separately",
  head_of_household: "Head of household",
  qualifying_surviving_spouse: "Qualifying surviving spouse",
};

export const DEDUCTION_METHODS = ["standard", "itemized"];

/** 50 states and the District of Columbia, for the profile form. */
export const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

const STATE_NAMES = Object.fromEntries(US_STATES.map((row) => [row.code, row.name]));

export function stateName(code) {
  const key = String(code || "").trim().toUpperCase();
  return STATE_NAMES[key] || "";
}

export function isFilingStatus(value) {
  return FILING_STATUSES.includes(value);
}

function pick(input, camel, snake) {
  if (input == null) return undefined;
  if (input[camel] != null && input[camel] !== "") return input[camel];
  if (input[snake] != null && input[snake] !== "") return input[snake];
  return undefined;
}

function count(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 20);
}

function rate(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Profile the calculator accepts. CamelCase and the API's snake_case both work.
 * Income amounts are whatever the caller already resolved (budget prefill or saved figures).
 */
export function normalizeTaxProfile(input = {}) {
  const filingRaw = String(pick(input, "filingStatus", "filing_status") || "single");
  const filingStatus = isFilingStatus(filingRaw) ? filingRaw : "single";
  const stateRaw = String(pick(input, "stateCode", "state_code") || "")
    .trim()
    .toUpperCase();
  const stateCode = /^[A-Z]{2}$/.test(stateRaw) && STATE_NAMES[stateRaw] ? stateRaw : "";
  const methodRaw = String(pick(input, "deductionMethod", "deduction_method") || "standard");
  const deductionMethod = methodRaw === "itemized" ? "itemized" : "standard";
  const zipRaw = String(pick(input, "localZip", "local_zip") || "").trim();
  return {
    filingStatus,
    stateCode,
    localJurisdiction: String(pick(input, "localJurisdiction", "local_jurisdiction") || "").trim().slice(0, 120),
    localZip: zipRaw.slice(0, 10),
    localRate: rate(pick(input, "localRate", "local_rate") || 0),
    childrenUnder17: count(pick(input, "childrenUnder17", "children_under_17")),
    otherDependents: count(pick(input, "otherDependents", "other_dependents")),
    deductionMethod,
    itemizedDeduction: Math.max(0, Number(pick(input, "itemizedDeduction", "itemized_deduction")) || 0),
    wages: Math.max(0, Number(pick(input, "wages", "wages")) || 0),
    selfEmployment: Math.max(0, Number(pick(input, "selfEmployment", "self_employment")) || 0),
    retirement: Math.max(0, Number(pick(input, "retirement", "retirement")) || 0),
    otherIncome: Math.max(0, Number(pick(input, "otherIncome", "other_income")) || 0),
  };
}

export function dependentCount(profile) {
  return profile.childrenUnder17 + profile.otherDependents;
}
