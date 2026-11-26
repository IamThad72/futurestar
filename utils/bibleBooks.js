/**
 * Book names, testaments and canon groups for every seeded translation.
 * `canon` is "protestant" for the 66 books every tradition shares,
 * "deuterocanon" for the books in the Catholic (and Orthodox) Old Testament,
 * and "extra" for books no FutureStar reading draws from (Prayer of Manasseh,
 * 1–2 Esdras, Psalm 151, 3–4 Maccabees, Laodiceans, Greek Esther and Daniel).
 */

const BOOK_ALIASES = {
  psalm: "psalms",
  revelation: "revelationofjohn",
  apocalypse: "revelationofjohn",
  songofsongs: "songofsolomon",
  canticleofcanticles: "songofsolomon",
  wisdomofsolomon: "wisdom",
  ecclesiasticus: "sirach",
  prayerofmanasseh: "prayerofmanasses",
  psalm151: "additionalpsalm",
};

export function normalizeBookKey(name) {
  const key = String(name || "")
    .toLowerCase()
    .replace(/^(the)\s+/, "")
    .replace(/\b(first|1st)\b/g, "1")
    .replace(/\b(second|2nd)\b/g, "2")
    .replace(/\b(third|3rd)\b/g, "3")
    .replace(/\b(fourth|4th)\b/g, "4")
    .replace(/\biii\b/g, "3")
    .replace(/\bii\b/g, "2")
    .replace(/\biv\b/g, "4")
    .replace(/\bi\b/g, "1")
    .replace(/[^a-z0-9]/g, "");
  return BOOK_ALIASES[key] || key;
}

/** eBible.org / USFM-style codes in canonical order, named the way the scrollmapper files name them. */
export const BOOK_CODES = [
  ["GEN", "Genesis"],
  ["EXO", "Exodus"],
  ["LEV", "Leviticus"],
  ["NUM", "Numbers"],
  ["DEU", "Deuteronomy"],
  ["JOS", "Joshua"],
  ["JDG", "Judges"],
  ["RUT", "Ruth"],
  ["1SA", "I Samuel"],
  ["2SA", "II Samuel"],
  ["1KI", "I Kings"],
  ["2KI", "II Kings"],
  ["1CH", "I Chronicles"],
  ["2CH", "II Chronicles"],
  ["EZR", "Ezra"],
  ["NEH", "Nehemiah"],
  ["EST", "Esther"],
  ["JOB", "Job"],
  ["PSA", "Psalms"],
  ["PRO", "Proverbs"],
  ["ECC", "Ecclesiastes"],
  ["SOL", "Song of Solomon"],
  ["SNG", "Song of Solomon"],
  ["ISA", "Isaiah"],
  ["JER", "Jeremiah"],
  ["LAM", "Lamentations"],
  ["EZE", "Ezekiel"],
  ["EZK", "Ezekiel"],
  ["DAN", "Daniel"],
  ["HOS", "Hosea"],
  ["JOE", "Joel"],
  ["JOL", "Joel"],
  ["AMO", "Amos"],
  ["OBA", "Obadiah"],
  ["JON", "Jonah"],
  ["MIC", "Micah"],
  ["NAH", "Nahum"],
  ["NAM", "Nahum"],
  ["HAB", "Habakkuk"],
  ["ZEP", "Zephaniah"],
  ["HAG", "Haggai"],
  ["ZEC", "Zechariah"],
  ["MAL", "Malachi"],
  ["TOB", "Tobit"],
  ["JDT", "Judith"],
  ["ESG", "Esther (Greek)"],
  ["WIS", "Wisdom"],
  ["SIR", "Sirach"],
  ["BAR", "Baruch"],
  ["1MA", "I Maccabees"],
  ["2MA", "II Maccabees"],
  ["1ES", "I Esdras"],
  ["PRM", "Prayer of Manasses"],
  ["MAN", "Prayer of Manasses"],
  ["PSX", "Additional Psalm"],
  ["PS2", "Additional Psalm"],
  ["3MA", "III Maccabees"],
  ["4ES", "II Esdras"],
  ["2ES", "II Esdras"],
  ["4MA", "IV Maccabees"],
  ["DNG", "Daniel (Greek)"],
  ["DAG", "Daniel (Greek)"],
  ["MAT", "Matthew"],
  ["MRK", "Mark"],
  ["MAR", "Mark"],
  ["LUK", "Luke"],
  ["JHN", "John"],
  ["JOH", "John"],
  ["ACT", "Acts"],
  ["ROM", "Romans"],
  ["1CO", "I Corinthians"],
  ["2CO", "II Corinthians"],
  ["GAL", "Galatians"],
  ["EPH", "Ephesians"],
  ["PHP", "Philippians"],
  ["PHI", "Philippians"],
  ["COL", "Colossians"],
  ["1TH", "I Thessalonians"],
  ["2TH", "II Thessalonians"],
  ["1TI", "I Timothy"],
  ["2TI", "II Timothy"],
  ["TIT", "Titus"],
  ["PHM", "Philemon"],
  ["HEB", "Hebrews"],
  ["JAS", "James"],
  ["JAM", "James"],
  ["1PE", "I Peter"],
  ["2PE", "II Peter"],
  ["1JN", "I John"],
  ["1JO", "I John"],
  ["2JN", "II John"],
  ["2JO", "II John"],
  ["3JN", "III John"],
  ["3JO", "III John"],
  ["JUD", "Jude"],
  ["REV", "Revelation of John"],
];

const CODE_TO_NAME = new Map(BOOK_CODES);

export function bookNameForCode(code) {
  return CODE_TO_NAME.get(String(code || "").trim().toUpperCase()) || "";
}

const NT_KEYS = new Set([
  "matthew",
  "mark",
  "luke",
  "john",
  "acts",
  "romans",
  "1corinthians",
  "2corinthians",
  "galatians",
  "ephesians",
  "philippians",
  "colossians",
  "1thessalonians",
  "2thessalonians",
  "1timothy",
  "2timothy",
  "titus",
  "philemon",
  "hebrews",
  "james",
  "1peter",
  "2peter",
  "1john",
  "2john",
  "3john",
  "jude",
  "revelationofjohn",
  "laodiceans",
]);

const DEUTEROCANON_KEYS = new Set([
  "tobit",
  "judith",
  "wisdom",
  "sirach",
  "baruch",
  "1maccabees",
  "2maccabees",
]);

const EXTRA_KEYS = new Set([
  "prayerofmanasses",
  "1esdras",
  "2esdras",
  "additionalpsalm",
  "laodiceans",
  "3maccabees",
  "4maccabees",
  "esthergreek",
  "danielgreek",
]);

/** @returns {{ key: string, testament: "old" | "new", canon: "protestant" | "deuterocanon" | "extra" }} */
export function classifyBook(name) {
  const key = normalizeBookKey(name);
  const testament = NT_KEYS.has(key) ? "new" : "old";
  let canon = "protestant";
  if (EXTRA_KEYS.has(key)) canon = "extra";
  else if (DEUTEROCANON_KEYS.has(key)) canon = "deuterocanon";
  return { key, testament, canon };
}

/** Whether random readings may draw from this book. Only Catholic mode reads the deuterocanon. */
export function bookAllowedForReading(name, { includeDeuterocanon = false } = {}) {
  const { canon } = classifyBook(name);
  if (canon === "protestant") return true;
  return canon === "deuterocanon" && includeDeuterocanon;
}

/** "I Samuel" → "1 Samuel", "Psalms" → "Psalm", for citations. */
export function displayBookName(name) {
  const book = String(name || "");
  if (book === "Psalms") return "Psalm";
  return book
    .replace(/^IV /, "4 ")
    .replace(/^III /, "3 ")
    .replace(/^II /, "2 ")
    .replace(/^I /, "1 ");
}
