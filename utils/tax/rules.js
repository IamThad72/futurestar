import federal2025 from "../../data/tax/federal/2025.json" with { type: "json" };
import federal2026 from "../../data/tax/federal/2026.json" with { type: "json" };
import states2025 from "../../data/tax/states/2025.json" with { type: "json" };
import states2026 from "../../data/tax/states/2026.json" with { type: "json" };

const FEDERAL_BY_YEAR = {
  2025: federal2025,
  2026: federal2026,
};

const STATES_BY_YEAR = {
  2025: states2025,
  2026: states2026,
};

const FEDERAL_YEARS = Object.keys(FEDERAL_BY_YEAR)
  .map(Number)
  .sort((a, b) => a - b);
const STATE_YEARS = Object.keys(STATES_BY_YEAR)
  .map(Number)
  .sort((a, b) => a - b);

function resolveYear(requested, years) {
  const year = Number(requested);
  if (years.includes(year)) return year;
  const earlier = years.filter((value) => value <= year);
  if (earlier.length) return earlier[earlier.length - 1];
  return years[0];
}

export function getFederalRules(year) {
  const rulesYear = resolveYear(year, FEDERAL_YEARS);
  return { rulesYear, rules: FEDERAL_BY_YEAR[rulesYear] };
}

export function getStateRules(year) {
  const rulesYear = resolveYear(year, STATE_YEARS);
  return { rulesYear, rules: STATES_BY_YEAR[rulesYear] };
}

export function supportedTaxYears() {
  return FEDERAL_YEARS.slice();
}
