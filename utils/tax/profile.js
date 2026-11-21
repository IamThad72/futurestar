import { nonNegativeMoney } from "./money.js";

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

export const FILING_STATUS_SHORT = {
  single: "Single",
  married_filing_jointly: "MFJ",
  married_filing_separately: "MFS",
  head_of_household: "HoH",
  qualifying_surviving_spouse: "QSS",
};

export const DEDUCTION_METHODS = ["standard", "itemized"];

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

function clampInt(value, min, max) {
  const n = Math.floor(Number(value) || 0);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function clampRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(0.15, n);
}

function text(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || "";
}

/**
 * A saved household profile. Returns null when filing status is missing so the
 * page can ask the user to set one up instead of assuming Single.
 */
export function normalizeTaxProfile(input) {
  if (input == null || typeof input !== "object") return null;
  const filingStatus = String(input.filingStatus || input.filing_status || "").trim();
  if (!FILING_STATUSES.includes(filingStatus)) return null;
  const deductionRaw = String(input.deductionMethod || input.deduction_method || "standard").trim();
  const deductionMethod = deductionRaw === "itemized" ? "itemized" : "standard";
  const paychecksRaw = Number(input.paychecksPerYear ?? input.paychecks_per_year);
  const paychecksPerYear =
    Number.isFinite(paychecksRaw) && paychecksRaw > 0 && paychecksRaw <= 366
      ? Math.floor(paychecksRaw)
      : null;
  const stateCode = String(input.stateCode || input.state_code || "")
    .trim()
    .toUpperCase();
  return {
    filingStatus,
    filingStatusLabel: FILING_STATUS_LABELS[filingStatus],
    filingStatusShort: FILING_STATUS_SHORT[filingStatus],
    stateCode,
    stateName: stateName(stateCode),
    childrenUnder17: clampInt(input.childrenUnder17 ?? input.children_under_17, 0, 20),
    otherDependents: clampInt(input.otherDependents ?? input.other_dependents, 0, 20),
    deductionMethod,
    itemizedDeduction: nonNegativeMoney(input.itemizedDeduction ?? input.itemized_deduction),
    localJurisdiction: text(input.localJurisdiction ?? input.local_jurisdiction),
    localCounty: text(input.localCounty ?? input.local_county),
    localZip: text(input.localZip ?? input.local_zip),
    schoolDistrict: text(input.schoolDistrict ?? input.school_district),
    cityRate: clampRate(input.cityRate ?? input.city_rate),
    schoolDistrictRate: clampRate(input.schoolDistrictRate ?? input.school_district_rate),
    localWageRule: text(input.localWageRule ?? input.local_wage_rule) || null,
    paychecksPerYear,
  };
}

export function dependentCount(profile) {
  return (Number(profile?.childrenUnder17) || 0) + (Number(profile?.otherDependents) || 0);
}

/** Taxpayer, plus a spouse on a joint return, plus dependents. */
export function ohioExemptionCount(profile) {
  const filer = profile?.filingStatus === "married_filing_jointly" ? 2 : 1;
  return filer + dependentCount(profile);
}

export function normalizeWithholding(withheld = {}) {
  const read = (key, alt) => nonNegativeMoney(withheld?.[key] ?? withheld?.[alt]);
  return {
    federal: read("federal"),
    state: read("state"),
    local: read("local"),
    medicare: read("medicare"),
    social_security: read("social_security", "socialSecurity"),
  };
}
