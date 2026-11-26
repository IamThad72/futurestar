/**
 * Faith tradition setting. One private row per user in user_faith_profiles.
 * The tradition picks the default translation, the calendar detail, the evening
 * label and the virtue wording. Catholic mode is the original FutureStar experience.
 */
import { DEFAULT_TRANSLATION, normalizeTranslationCode } from "./bibleTranslations.js";

export const DEFAULT_TRADITION = "christian";

export const FAITH_TRADITIONS = [
  {
    value: "christian",
    label: "Christian",
    description: "Non-denominational. Scripture, prayer and reflection, with the church year in the background.",
  },
  {
    value: "protestant",
    label: "Protestant",
    description: "Evangelical, mainline or Reformed. Scripture-first, with the church year in the background.",
  },
  {
    value: "catholic",
    label: "Catholic",
    description: "The Catholic Bible (CPDV), the General Roman Calendar with saints' days, and the Evening Examen.",
  },
  {
    value: "orthodox",
    label: "Orthodox",
    description: "The church year dated from Orthodox Pascha, with Great Lent and the Nativity Fast.",
  },
];

const TRADITION_VALUES = new Set(FAITH_TRADITIONS.map((item) => item.value));

const TRADITION_DEFAULTS = {
  christian: { translation: "BSB" },
  protestant: { translation: "BSB" },
  catholic: { translation: "CPDV" },
  orthodox: { translation: "WEB" },
};

export function normalizeTradition(value) {
  const tradition = String(value || "").trim().toLowerCase();
  return TRADITION_VALUES.has(tradition) ? tradition : "";
}

export function traditionLabel(value) {
  return FAITH_TRADITIONS.find((item) => item.value === normalizeTradition(value))?.label || "Christian";
}

export function defaultTranslationForTradition(tradition) {
  return TRADITION_DEFAULTS[normalizeTradition(tradition)]?.translation || DEFAULT_TRANSLATION;
}

/** Profile used when a user has not chosen yet. */
export function defaultFaithProfile(tradition = DEFAULT_TRADITION) {
  const value = normalizeTradition(tradition) || DEFAULT_TRADITION;
  return {
    tradition: value,
    translation: defaultTranslationForTradition(value),
    show_calendar: true,
  };
}

/**
 * Profile used before scripts/create_faith_profiles.sql has been run: the app
 * behaves exactly as it did before the tradition setting existed.
 */
export function legacyFaithProfile() {
  return defaultFaithProfile("catholic");
}

function parseBool(value, fallback) {
  if (value === true || value === false) return value;
  if (value == null || value === "") return fallback;
  const text = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(text)) return true;
  if (["false", "0", "no", "off"].includes(text)) return false;
  return fallback;
}

/**
 * Validate a saved or submitted profile. Missing fields take the tradition's
 * defaults. With `strict`, an unknown tradition or translation throws.
 *
 * @param {Record<string, unknown> | null | undefined} input
 * @param {{ strict?: boolean, base?: { tradition: string, translation: string, show_calendar: boolean } | null }} [options]
 */
export function normalizeFaithProfile(input, { strict = false, base = null } = {}) {
  const source = input && typeof input === "object" ? input : {};
  const start = base ? { ...base } : defaultFaithProfile();

  let tradition = start.tradition;
  if (source.tradition != null && source.tradition !== "") {
    const parsed = normalizeTradition(source.tradition);
    if (!parsed && strict) throw new Error("Choose Christian, Protestant, Catholic or Orthodox.");
    if (parsed) tradition = parsed;
  }

  const traditionChanged = tradition !== start.tradition;
  let translation = traditionChanged && source.translation == null
    ? defaultTranslationForTradition(tradition)
    : normalizeTranslationCode(start.translation) || defaultTranslationForTradition(tradition);
  if (source.translation != null && source.translation !== "") {
    const parsed = normalizeTranslationCode(source.translation);
    if (!parsed && strict) throw new Error("Choose a Bible translation from the list.");
    if (parsed) translation = parsed;
  }

  const showCalendar = parseBool(source.show_calendar ?? source.showCalendar, start.show_calendar !== false);

  return { tradition, translation, show_calendar: showCalendar };
}

/** "roman" (General Roman Calendar with saints), "church_year" (computed), or "off". */
export function calendarKindForProfile(profile) {
  if (profile && profile.show_calendar === false) return "off";
  return normalizeTradition(profile?.tradition) === "catholic" ? "roman" : "church_year";
}

/** Only Catholic mode draws daily readings from Tobit, Judith, Wisdom, Sirach, Baruch and Maccabees. */
export function includesDeuterocanon(tradition) {
  return normalizeTradition(tradition) === "catholic";
}

export function isCatholicTradition(tradition) {
  return normalizeTradition(tradition) === "catholic";
}

export function eveningLabel(tradition) {
  return isCatholicTradition(tradition) ? "Evening Examen" : "Evening Reflection";
}

/** Short noun for buttons and notices: "examen" or "reflection". */
export function eveningNoun(tradition) {
  return isCatholicTradition(tradition) ? "examen" : "reflection";
}

export function calendarLabel(tradition) {
  return isCatholicTradition(tradition) ? "liturgical calendar" : "church calendar";
}
