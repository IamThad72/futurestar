/**
 * Household serving labels for USDA food portions.
 * DB stores amount + unit name (tablespoon, cup, slice) and gram_weight.
 * The journal UI shows ounces first, with grams in parentheses.
 * 1 oz = 28.3495 g (avoirdupois).
 */

export const GRAMS_PER_OUNCE = 28.3495;

const SKIP_PLURAL = new Set([
  "each",
  "oz",
  "fl oz",
  "lb",
  "g",
  "ml",
  "racc",
  "undetermined",
  "medium",
  "large",
  "small",
  "tbsp",
  "tsp",
]);

const IRREGULAR_PLURALS = {
  leaf: "leaves",
  loaf: "loaves",
  patty: "patties",
  shrimp: "shrimp",
  each: "each",
};

export function formatPortionAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount == null || amount === "" ? "" : String(amount).trim();
  if (Number.isInteger(n)) return String(n);
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
}

export function formatPortionGrams(gramWeight) {
  const n = Number(gramWeight);
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function gramsToOunces(grams) {
  const n = Number(grams);
  if (!Number.isFinite(n)) return null;
  return n / GRAMS_PER_OUNCE;
}

export function ouncesToGrams(ounces) {
  const n = Number(ounces);
  if (!Number.isFinite(n)) return null;
  return n * GRAMS_PER_OUNCE;
}

export function formatPortionOunces(gramWeight, digits = 2) {
  const oz = gramsToOunces(gramWeight);
  if (oz == null) return "";
  const factor = 10 ** digits;
  const rounded = Math.round(oz * factor) / factor;
  if (!Number.isFinite(rounded)) return "";
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits);
}

/** Dual display: `1.2 oz (33.9 g)`. Ounces are the primary unit. */
export function formatWeightOzGrams(gramWeight, ozDigits = 2) {
  const oz = formatPortionOunces(gramWeight, ozDigits);
  const grams = formatPortionGrams(gramWeight);
  if (oz && grams) return `${oz} oz (${grams} g)`;
  if (oz) return `${oz} oz`;
  if (grams) return `${grams} g`;
  return "";
}

function isBareGramLabel(value) {
  return /^\d+(?:\.\d+)?\s*g$/i.test(String(value || "").trim());
}

export function pluralizePortionUnit(unit, amount) {
  const raw = String(unit || "").trim();
  if (!raw) return "";
  const n = Number(amount);
  if (!Number.isFinite(n) || n === 1) return raw;
  const lower = raw.toLowerCase();
  if (SKIP_PLURAL.has(lower)) return raw;
  if (raw === raw.toUpperCase() && /[A-Z]/.test(raw)) return raw;
  if (IRREGULAR_PLURALS[lower]) return IRREGULAR_PLURALS[lower];
  if (!/^[A-Za-z]+$/.test(raw)) return raw;
  if (lower.endsWith("s")) return raw;
  if (/(?:ch|sh|x|z)$/.test(lower)) return `${raw}es`;
  if (lower.endsWith("y") && !/[aeiou]y$/.test(lower)) return `${raw.slice(0, -1)}ies`;
  return `${raw}s`;
}

export function householdPortionLabel(portion) {
  const amount = formatPortionAmount(portion?.amount);
  const unit = pluralizePortionUnit(portion?.measure_name || portion?.unit, portion?.amount);
  return [amount, unit].filter(Boolean).join(" ").trim();
}

export function formatPortionDropdownLabel(portion) {
  const household = householdPortionLabel(portion);
  const weight = formatWeightOzGrams(portion?.gram_weight);
  if (!household || isBareGramLabel(household)) return weight || household || "portion";
  if (weight) return `${household} · ${weight}`;
  return household;
}

export function isHouseholdPortionUnit(unit) {
  const value = String(unit || "").trim().toLowerCase();
  return Boolean(value) && value !== "racc" && value !== "undetermined";
}
