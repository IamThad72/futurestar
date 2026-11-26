/**
 * Public-domain Bible translations FutureStar can seed and show.
 * Shared by the server, the seed script and the Faith settings screen.
 *
 * Psalm references in code use the standard (Hebrew/English) numbering.
 * Translations with `versification: "vulgate"` (CPDV) are looked up through
 * utils/psalmNumbering.js.
 */

export const DEFAULT_TRANSLATION = "BSB";

/** Used when the chosen translation has no rows yet (the app shipped with CPDV only). */
export const FALLBACK_TRANSLATION = "CPDV";

export const BIBLE_TRANSLATIONS = [
  {
    code: "BSB",
    name: "Berean Standard Bible",
    title: "BSB: Berean Standard Bible",
    versification: "standard",
    canon: "protestant",
    license: "Public domain (dedicated to the public domain on April 30, 2023)",
    licenseUrl: "https://berean.bible/terms.htm",
    source: {
      format: "scrollmapper-json",
      url: "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/BSB.json",
      file: "BSB.json",
    },
    description: "Modern, readable English. The default for new accounts.",
  },
  {
    code: "WEB",
    name: "World English Bible",
    title: "WEB: World English Bible",
    versification: "standard",
    canon: "ecumenical",
    license: "Public domain (\"World English Bible\" is a trademark of eBible.org; text kept unchanged)",
    licenseUrl: "https://ebible.org/web/copyright.htm",
    source: {
      format: "ebible-vpl-zip",
      url: "https://ebible.org/Scriptures/eng-web_vpl.zip",
      file: "eng-web_vpl.zip",
    },
    description: "Modern English from eBible.org.",
  },
  {
    code: "KJV",
    name: "King James Version",
    title: "KJV: King James Version (1769)",
    versification: "standard",
    canon: "protestant",
    license: "Public domain in the United States",
    licenseUrl: "https://github.com/scrollmapper/bible_databases",
    source: {
      format: "scrollmapper-json",
      url: "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/KJV.json",
      file: "KJV.json",
    },
    description: "Traditional wording.",
  },
  {
    code: "CPDV",
    name: "Catholic Public Domain Version",
    title: "CPDV: Catholic Public Domain Version",
    versification: "vulgate",
    canon: "catholic",
    license: "Public domain",
    licenseUrl: "https://github.com/scrollmapper/bible_databases",
    source: {
      format: "scrollmapper-json",
      url: "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/CPDV.json",
      file: "CPDV.json",
    },
    description: "Catholic canon with Vulgate psalm numbering.",
  },
];

const BY_CODE = new Map(BIBLE_TRANSLATIONS.map((item) => [item.code, item]));

export const TRANSLATION_CODES = BIBLE_TRANSLATIONS.map((item) => item.code);

export function normalizeTranslationCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return BY_CODE.has(code) ? code : "";
}

export function bibleTranslation(code) {
  return BY_CODE.get(normalizeTranslationCode(code)) || null;
}

export function translationName(code) {
  return bibleTranslation(code)?.name || "";
}

export function translationVersification(code) {
  return bibleTranslation(code)?.versification || "standard";
}
