export type LocalRecommendedService = {
  service_name: string;
  interval_miles: number | null;
  interval_months: number | null;
  is_oem: boolean;
};

type ScheduleBuilder = (year: number, model: string) => LocalRecommendedService[];

function item(
  service_name: string,
  interval_miles: number | null,
  interval_months: number | null = null,
): LocalRecommendedService {
  return { service_name, interval_miles, interval_months, is_oem: true };
}

/** Conservative US light-vehicle maintenance intervals used when no make-specific plan matches. */
const genericSchedule: ScheduleBuilder = () => [
  item("Engine oil and filter change", 5000, 6),
  item("Tire rotation", 7500, 6),
  item("Inspect brake pads, rotors, and lines", 10000, 12),
  item("Replace engine air filter", 15000, 12),
  item("Replace cabin air filter", 15000, 12),
  item("Replace spark plugs", 60000, 60),
  item("Flush and replace brake fluid", 30000, 36),
  item("Replace coolant / inspect cooling system", 60000, 60),
  item("Inspect / service transmission fluid", 60000, 60),
  item("Replace serpentine belt", 90000, 84),
];

/**
 * Toyota FJ Cruiser — 2013 Owner's Manual OM35A71U (MAINT REQD at 5,000 mi)
 * plus FJ Cruiser Scheduled Maintenance Guide intervals (companion SMG).
 * OM: https://assets.sipb.toyota.com/publications/en/om-s/OM35A71U/pdf/OM35A71U.pdf
 * SMG: https://assets.sia.toyota.com/publications/en/omms-s/T-MMS-08FJCruiser/pdf/T-MMS-08FJCruiser.pdf
 */
const fjCruiserSchedule: ScheduleBuilder = () => [
  item("MAINT REQD / scheduled visit — oil & filter; reset maintenance data (every 5,000 mi or 6 months)", 5000, 6),
  item("Rotate tires", 5000, 6),
  item("Visually inspect brake linings/drums and brake pads/discs", 5000, 6),
  item("Clean cabin air filter (replace by 15,000 mi / 18 months)", 5000, 6),
  item("Replace cabin air filter", 15000, 18),
  item("Lubricate propeller shaft / re-torque bolts (4WD; also after road-salt use)", 15000, 18),
  item("Inspect differentials, transfer case, steering, boots, coolant, exhaust (15k inspection set)", 15000, 18),
  item("Replace engine air filter", 30000, 36),
  item("Replace spark plugs", 30000, 36),
  item("Inspect ATF / MT oil / transfer / differentials (30k/60k service)", 30000, 36),
  item("Inspect drive belts (initial at 60,000 mi / 72 months)", 60000, 72),
  item("Replace ATF / differential / transfer oils when towing (special conditions)", 60000, 72),
  item("Replace engine coolant (initial; then every 50,000 mi / 60 months)", 100000, 120),
];

/** Make-specific refinements based on common published OEM cadence (not live OEM manuals). */
const makeSchedules: Record<string, ScheduleBuilder> = {
  /**
   * 2018 Toyota C-HR Warranty and Maintenance Guide (T-MMS-18C-HR).
   * Scheduled maintenance every 5,000 miles or 6 months, whichever comes first.
   * Source: https://assets.sia.toyota.com/publications/en/omms-s/T-MMS-18CHR/pdf/T-MMS-18C-HR.pdf
   */
  toyota: () => [
    item("Scheduled maintenance visit (every 5,000 mi or 6 months, whichever first)", 5000, 6),
    item("Replace engine oil and oil filter; reset MAINT REQD / OIL MAINTENANCE REQUIRED", 10000, 12),
    item("Rotate tires", 5000, 6),
    item("Visually inspect brake linings/drums and brake pads/discs", 5000, 6),
    item("Inspect and adjust fluid levels (incl. brake fluid condition)", 5000, 6),
    item("Inspect wiper blades", 5000, 6),
    item("Replace cabin air filter", 30000, 36),
    item("Replace engine air filter", 30000, 36),
    item("30k/60k multi-point inspection (brakes, boots, coolant, steering, exhaust, fuel system)", 30000, 36),
    item("Inspect drive belts", 60000, 72),
    item("Replace automatic transmission fluid (special operating conditions)", 60000, 72),
    item("Replace engine coolant (initial; then every 50,000 mi / 60 months)", 100000, 120),
    item("Replace spark plugs", 120000, 144),
  ],
  honda: (year) => [
    item("Engine oil and filter change (Maintenance Minder / interval)", year >= 2011 ? 7500 : 5000, 12),
    item("Tire rotation", 7500, 12),
    item("Inspect brake pads, rotors, and lines", 7500, 12),
    item("Replace engine air filter", 15000, 24),
    item("Replace cabin air filter", 15000, 12),
    item("Replace spark plugs", 100000, 96),
    item("Replace brake fluid", 30000, 36),
    item("Inspect coolant; replace as required", 100000, 120),
    item("Inspect drive belts", 30000, 24),
    item("Replace transmission fluid (if applicable)", 60000, 60),
  ],
  ford: () => [
    item("Engine oil and filter change", 7500, 6),
    item("Tire rotation", 7500, 6),
    item("Inspect brake pads, rotors, and lines", 10000, 12),
    item("Replace engine air filter", 30000, 24),
    item("Replace cabin air filter", 20000, 24),
    item("Replace spark plugs", 100000, 96),
    item("Replace brake fluid", 30000, 36),
    item("Replace engine coolant", 100000, 60),
    item("Inspect / change transfer case & differential fluid (4WD/AWD)", 30000, 36),
    item("Replace transmission fluid", 60000, 60),
  ],
  chevrolet: () => [
    item("Engine oil and filter change", 7500, 12),
    item("Tire rotation", 7500, 12),
    item("Inspect brake pads, rotors, and lines", 10000, 12),
    item("Replace engine air filter", 45000, 24),
    item("Replace cabin air filter", 22500, 24),
    item("Replace spark plugs", 100000, 96),
    item("Flush and replace brake fluid", 45000, 36),
    item("Replace engine coolant", 150000, 60),
    item("Replace transmission fluid", 45000, 48),
  ],
  chevy: (year, model) => makeSchedules.chevrolet(year, model),
  bmw: () => [
    item("Engine oil and filter change", 10000, 12),
    item("Tire rotation / inspect tread and pressure", 10000, 12),
    item("Vehicle check / brake inspection", 10000, 12),
    item("Replace microfilter / cabin filter", 20000, 24),
    item("Replace spark plugs", 60000, 60),
    item("Replace brake fluid", 20000, 24),
    item("Replace engine air filter", 30000, 36),
    item("Inspect / replace coolant", 60000, 48),
  ],
  mercedes: () => [
    item("Engine oil and filter change", 10000, 12),
    item("Tire rotation / inspect tread and pressure", 10000, 12),
    item("Brake inspection", 10000, 12),
    item("Replace cabin dust filter", 20000, 24),
    item("Replace spark plugs", 60000, 60),
    item("Replace brake fluid", 20000, 24),
    item("Replace engine air filter", 40000, 36),
    item("Service transmission fluid (if applicable)", 40000, 48),
  ],
  "mercedes-benz": (year, model) => makeSchedules.mercedes(year, model),
  subaru: () => [
    item("Engine oil and filter change", 6000, 6),
    item("Tire rotation", 6000, 6),
    item("Inspect brake pads, rotors, and lines", 12000, 12),
    item("Replace engine air filter", 30000, 30),
    item("Replace cabin air filter", 15000, 12),
    item("Replace spark plugs", 60000, 60),
    item("Replace brake fluid", 30000, 30),
    item("Replace coolant", 110000, 132),
    item("Replace CVT / transmission fluid", 30000, 30),
    item("Replace differential gear oil", 30000, 30),
  ],
  nissan: () => [
    item("Engine oil and filter change", 5000, 6),
    item("Tire rotation", 7500, 6),
    item("Inspect brake pads, rotors, and lines", 10000, 12),
    item("Replace engine air filter", 15000, 12),
    item("Replace cabin air filter", 15000, 12),
    item("Replace spark plugs", 105000, 84),
    item("Replace brake fluid", 30000, 24),
    item("Replace engine coolant", 105000, 84),
    item("Inspect / replace CVT fluid", 30000, 24),
  ],
  hyundai: () => [
    item("Engine oil and filter change", 7500, 12),
    item("Tire rotation", 7500, 12),
    item("Inspect brake pads, rotors, and lines", 7500, 12),
    item("Replace engine air filter", 22500, 24),
    item("Replace cabin air filter", 15000, 12),
    item("Replace spark plugs", 75000, 72),
    item("Replace brake fluid", 30000, 24),
    item("Replace engine coolant", 120000, 120),
    item("Replace automatic transmission fluid", 60000, 60),
  ],
  kia: (year, model) => makeSchedules.hyundai(year, model),
  volkswagen: () => [
    item("Engine oil and filter change", 10000, 12),
    item("Tire rotation", 10000, 12),
    item("Inspect brake pads, rotors, and lines", 10000, 12),
    item("Replace engine air filter", 20000, 24),
    item("Replace cabin pollen filter", 20000, 24),
    item("Replace spark plugs", 60000, 60),
    item("Replace brake fluid", 20000, 24),
    item("Inspect DSG / transmission service interval", 40000, 48),
  ],
  vw: (year, model) => makeSchedules.volkswagen(year, model),
  jeep: () => [
    item("Engine oil and filter change", 5000, 6),
    item("Tire rotation", 7500, 6),
    item("Inspect brake pads, rotors, and lines", 10000, 12),
    item("Replace engine air filter", 15000, 12),
    item("Replace cabin air filter", 15000, 12),
    item("Replace spark plugs", 100000, 96),
    item("Replace brake fluid", 30000, 36),
    item("Replace transfer case fluid (4WD)", 30000, 36),
    item("Replace front/rear axle fluid", 30000, 36),
    item("Replace transmission fluid", 60000, 60),
  ],
  ram: (year, model) => makeSchedules.jeep(year, model),
  dodge: (year, model) => makeSchedules.jeep(year, model),
  gmc: (year, model) => makeSchedules.chevrolet(year, model),
  buick: (year, model) => makeSchedules.chevrolet(year, model),
  lexus: (year, model) => makeSchedules.toyota(year, model),
  /**
   * 2025 Acura Integra Owner's Manual (B3S52525OM) — Maintenance Minder™ (U.S.).
   * Oil/filter and many items are condition-based via Minder codes; footnotes supply
   * time/mileage fallbacks used below.
   * Source: https://techinfo.honda.com/rjanisis/pubs/OM/AH/B3S52525OM/enu/B3S52525OMEN.PDF
   */
  acura: () => [
    item("Minder A — Replace engine oil (at least every 12 months if no Minder message)", null, 12),
    item("Minder B — Replace engine oil and oil filter; inspect brakes; multi-point inspection", null, 12),
    item("Minder 1 — Rotate tires", null, 12),
    item("Minder 2 — Replace air cleaner element (every 15,000 mi in dusty conditions)", 15000, null),
    item("Minder 2 — Replace dust and pollen filter (every 15,000 mi in high-soot urban areas)", 15000, null),
    item("Minder 2 — Inspect drive belt", null, 12),
    item("Minder 3 — Replace CVT fluid (severe mountain/low-speed driving)", 25000, null),
    item("Minder 3 — Replace manual transmission fluid (severe mountain/low-speed driving)", 37500, null),
    item("Minder 3 — Replace transmission fluid (follow Maintenance Minder)", null, null),
    item("Minder 4 — Replace spark plugs; inspect valve clearance", null, null),
    item("Minder 5 — Replace engine coolant", null, null),
    item("Minder 7 — Replace brake fluid (every 3 years if no Minder item 7)", null, 36),
  ],
  /**
   * 2016 MINI Hardtop Owner's Manual — Condition Based Service (CBS).
   * Intervals are CBS / time-dependent per the Mobility > Maintenance chapter;
   * detailed mileages are in the Service and Warranty Information Booklet (US).
   * Source: https://www.miniusa.com/content/dam/mini/PDF/archiveownermanuals/my16/2016_MINI_Hardtop_owner_manual.pdf
   */
  mini: () => [
    item("CBS — Engine oil service (do not exceed service data shown in the vehicle)", null, 12),
    item("CBS — Vehicle check (follow Service required display / CBS)", null, 24),
    item("CBS — Front brake service (when indicated by CBS)", null, null),
    item("CBS — Rear brake service (when indicated by CBS)", null, null),
    item("CBS / scheduled — Replace microfilter / activated-charcoal filter", null, 24),
    item("Time-dependent — Check / replace brake fluid", null, 24),
    item("CBS — Spark plugs (when indicated by CBS / Service required)", null, null),
    item("Inspect coolant level (Min/Max marks); service as needed", null, 12),
    item("State inspection / emissions inspection (enter due date in vehicle)", null, 12),
    item("Consult US Service and Warranty Information Booklet for full scope", null, null),
  ],
  "mini-cooper": (year, model) => makeSchedules.mini(year, model),
  minicooper: (year, model) => makeSchedules.mini(year, model),
  /**
   * 2013 Mazda3 Scheduled Maintenance (USA Schedule 1 — normal conditions).
   * Use Schedule 2 (5,000 mi) if severe/special operating conditions apply.
   * Source: https://www.mazdausa.com/siteassets/pdf/owners-optimized/2013/mazda3-5door/2013-mazda3-maintenance-schedule.pdf
   */
  mazda: () => [
    item("Schedule 1 — Replace engine oil and oil filter", 7500, 6),
    item("Schedule 1 — Rotate tires", 7500, 6),
    item("Inspect disc brakes", 15000, 12),
    item("Inspect brake lines, hoses and connections", 30000, 24),
    item("Replace cabin air filter", 25000, 24),
    item("Replace engine air filter", 30000, 24),
    item("Inspect drive belts", 60000, 48),
    item("Inspect exhaust system and heat shields", 45000, 60),
    item("Replace spark plugs", 75000, null),
    item("Replace engine coolant (FL22: first at 120,000 mi / 10 years; then every 60,000 mi / 5 years)", 120000, 120),
    item("Schedule 2 note — If severe conditions apply, service every 5,000 mi / 4 months instead", 5000, 4),
  ],
  tesla: () => [
    item("Tire rotation", 6250, 6),
    item("Cabin air filter replacement", 20000, 24),
    item("Brake fluid check / replace as needed", null, 24),
    item("A/C desiccant bag service (varies by model)", null, 36),
    item("Brake caliper service / clean and lubricate (winter climates)", null, 12),
    item("Coolant check / replace as needed", 50000, 48),
  ],
};

function normalizeSlug(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isFjCruiser(make: string, model: string) {
  const makeKey = normalizeSlug(make);
  const modelKey = normalizeSlug(model);
  const blob = `${makeKey} ${modelKey}`;
  return (
    makeKey === "fj" ||
    makeKey === "fj-cruiser" ||
    makeKey === "fjcruiser" ||
    modelKey.includes("fj-cruiser") ||
    modelKey === "fj" ||
    modelKey.includes("fjcruiser") ||
    /\bfj\b/.test(blob)
  );
}

/**
 * Build a recommended service plan locally from year/make/model.
 * No external network calls; intervals are common published OEM-style guidance.
 */
export function buildLocalRecommendedSchedule(year: number, make: string, model: string): {
  services: LocalRecommendedService[];
  source: string;
  makeMatched: boolean;
} {
  const key = normalizeSlug(make);
  let builder: ScheduleBuilder = (key && makeSchedules[key]) || genericSchedule;
  let source = key && makeSchedules[key] ? `local:${key}` : "local:generic";
  let makeMatched = Boolean(key && makeSchedules[key]);

  if (isFjCruiser(make, model)) {
    builder = fjCruiserSchedule;
    source = "local:toyota:fj-om35a71u";
    makeMatched = true;
  } else if (key === "acura") {
    source = "local:acura:om-B3S52525";
  } else if (key === "mini" || key === "mini-cooper" || key === "minicooper") {
    source = "local:mini:om-2016-hardtop";
  } else if (key === "toyota" || key === "lexus") {
    source = "local:toyota:mms-18c-hr";
  } else if (key === "mazda") {
    source = "local:mazda:mms-2013-mazda3";
  }

  const services = builder(year, model).map((svc) => ({ ...svc }));
  services.sort((a, b) => {
    const am = a.interval_miles ?? Number.MAX_SAFE_INTEGER;
    const bm = b.interval_miles ?? Number.MAX_SAFE_INTEGER;
    if (am !== bm) return am - bm;
    const amon = a.interval_months ?? Number.MAX_SAFE_INTEGER;
    const bmon = b.interval_months ?? Number.MAX_SAFE_INTEGER;
    if (amon !== bmon) return amon - bmon;
    return a.service_name.localeCompare(b.service_name);
  });

  return {
    services,
    source,
    makeMatched,
  };
}
