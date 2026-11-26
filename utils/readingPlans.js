/**
 * Built-in reading plans. Plans live in code (no seed): each plan produces its
 * days from standard references, so they work in every translation (the CPDV
 * psalm mapping is applied when the text is looked up). Only a person's
 * enrollment and progress are stored (user_reading_plans, user_reading_progress).
 */
import { classifyBook, displayBookName } from "./bibleBooks.js";
import { orthodoxEasterIso, westernEasterIso } from "./christianYear.js";
import { isRealIsoDate } from "./isoDate.js";

// Chapter counts in standard numbering. Protestant canon order.
const OT_BOOKS = [
  ["Genesis", 50], ["Exodus", 40], ["Leviticus", 27], ["Numbers", 36], ["Deuteronomy", 34],
  ["Joshua", 24], ["Judges", 21], ["Ruth", 4], ["1 Samuel", 31], ["2 Samuel", 24],
  ["1 Kings", 22], ["2 Kings", 25], ["1 Chronicles", 29], ["2 Chronicles", 36], ["Ezra", 10],
  ["Nehemiah", 13], ["Esther", 10], ["Job", 42], ["Psalms", 150], ["Proverbs", 31],
  ["Ecclesiastes", 12], ["Song of Solomon", 8], ["Isaiah", 66], ["Jeremiah", 52], ["Lamentations", 5],
  ["Ezekiel", 48], ["Daniel", 12], ["Hosea", 14], ["Joel", 3], ["Amos", 9],
  ["Obadiah", 1], ["Jonah", 4], ["Micah", 7], ["Nahum", 3], ["Habakkuk", 3],
  ["Zephaniah", 3], ["Haggai", 2], ["Zechariah", 14], ["Malachi", 4],
];

const NT_BOOKS = [
  ["Matthew", 28], ["Mark", 16], ["Luke", 24], ["John", 21], ["Acts", 28],
  ["Romans", 16], ["1 Corinthians", 16], ["2 Corinthians", 13], ["Galatians", 6], ["Ephesians", 6],
  ["Philippians", 4], ["Colossians", 4], ["1 Thessalonians", 5], ["2 Thessalonians", 3], ["1 Timothy", 6],
  ["2 Timothy", 4], ["Titus", 3], ["Philemon", 1], ["Hebrews", 13], ["James", 5],
  ["1 Peter", 5], ["2 Peter", 3], ["1 John", 5], ["2 John", 1], ["3 John", 1],
  ["Jude", 1], ["Revelation", 22],
];

/** Deuterocanonical books and where the Catholic Old Testament places them. */
const DEUTEROCANON = [
  { book: "Tobit", chapters: 14, after: "Nehemiah" },
  { book: "Judith", chapters: 16, after: "Tobit" },
  { book: "1 Maccabees", chapters: 16, after: "Esther" },
  { book: "2 Maccabees", chapters: 15, after: "1 Maccabees" },
  { book: "Wisdom", chapters: 19, after: "Song of Solomon" },
  { book: "Sirach", chapters: 51, after: "Wisdom" },
  { book: "Baruch", chapters: 6, after: "Lamentations" },
];

export const CATHOLIC_EXTRA_CHAPTERS = { Esther: 16, Daniel: 14 };

export const BOOK_CHAPTERS = Object.fromEntries(
  [...OT_BOOKS, ...NT_BOOKS, ...DEUTEROCANON.map((item) => [item.book, item.chapters])],
);

/** Old Testament books in order; with the deuterocanon placed as in Catholic Bibles. */
export function oldTestamentBooks({ includeDeuterocanon = false } = {}) {
  const books = OT_BOOKS.map(([book, chapters]) => ({ book, chapters }));
  if (!includeDeuterocanon) return books;
  // Catholic Bibles also carry the Greek parts of Esther (11–16 in Vulgate
  // numbering) and Daniel (13–14). Translations without them use the CPDV.
  for (const item of books) {
    if (item.book === "Esther") item.chapters = CATHOLIC_EXTRA_CHAPTERS.Esther;
    if (item.book === "Daniel") item.chapters = CATHOLIC_EXTRA_CHAPTERS.Daniel;
  }
  for (const extra of DEUTEROCANON) {
    const index = books.findIndex((item) => item.book === extra.after);
    books.splice(index + 1, 0, { book: extra.book, chapters: extra.chapters });
  }
  return books;
}

function chapterList(books) {
  return books.flatMap(({ book, chapters }) =>
    Array.from({ length: chapters }, (_, index) => ({ book, chapter: index + 1 })),
  );
}

// ---------------------------------------------------------------- references

/**
 * Parse "Isaiah 9:2-7", "Psalm 51", "John 18-19", "Isaiah 52:13-53:12" or
 * "Psalm 89:1-4" into a reading: { book, citation, segments: [{ chapter, start, end }] }.
 * A segment with start null is a whole chapter; end null means to the end of the chapter.
 */
export function parseReference(text) {
  const raw = String(text || "").trim();
  const match = /^((?:[1-4]\s)?[A-Za-z][A-Za-z ]*?)\s+(\d+)(?::(\d+))?(?:\s*[-–]\s*(\d+)(?::(\d+))?)?$/.exec(raw);
  if (!match) throw new Error(`Cannot read reference "${raw}"`);
  const [, bookRaw, c1, v1, x, v2] = match;
  let book = bookRaw.trim();
  if (/^psalm$/i.test(book)) book = "Psalms";
  const chapter = Number(c1);
  const segments = [];
  if (v1 == null) {
    // "John 18" or "John 18-19"
    const last = x == null ? chapter : Number(x);
    for (let c = chapter; c <= last; c += 1) segments.push({ chapter: c, start: null, end: null });
  } else if (x == null) {
    segments.push({ chapter, start: Number(v1), end: Number(v1) });
  } else if (v2 == null) {
    segments.push({ chapter, start: Number(v1), end: Number(x) });
  } else {
    // Crosses chapters: "52:13-53:12"
    segments.push({ chapter, start: Number(v1), end: null });
    for (let c = chapter + 1; c < Number(x); c += 1) segments.push({ chapter: c, start: null, end: null });
    segments.push({ chapter: Number(x), start: 1, end: Number(v2) });
  }
  return { book, citation: formatCitation(book, raw.slice(bookRaw.length).trim()), segments };
}

function formatCitation(book, rest) {
  return `${displayBookName(book)} ${rest.replace(/-/g, "–")}`;
}

/** Group consecutive whole chapters of one book: "Genesis 1–3". */
export function readingsFromChapters(chapters) {
  const readings = [];
  for (const item of chapters) {
    const last = readings[readings.length - 1];
    if (last && last.book === item.book && last.lastChapter + 1 === item.chapter) {
      last.lastChapter = item.chapter;
      last.segments.push({ chapter: item.chapter, start: null, end: null });
    } else {
      readings.push({ book: item.book, firstChapter: item.chapter, lastChapter: item.chapter, segments: [{ chapter: item.chapter, start: null, end: null }] });
    }
  }
  return readings.map((reading) => ({
    book: reading.book,
    citation:
      reading.firstChapter === reading.lastChapter
        ? `${displayBookName(reading.book)} ${reading.firstChapter}`
        : `${displayBookName(reading.book)} ${reading.firstChapter}–${reading.lastChapter}`,
    segments: reading.segments,
  }));
}

/** Split `items` into `days` nearly equal, in-order parts. */
export function spreadEvenly(items, days) {
  const total = items.length;
  return Array.from({ length: days }, (_, index) =>
    items.slice(Math.floor((index * total) / days), Math.floor(((index + 1) * total) / days)),
  );
}

export function isDeuterocanonicalReading(reading) {
  return classifyBook(reading.book).canon !== "protestant";
}

/**
 * Day spec strings: readings separated by ";". A " || " part is the version
 * used when the deuterocanon is not read (non-Catholic modes).
 */
function daysFromSpecs(specs, includeDeuterocanon) {
  return specs.map((spec) => {
    const [primary, alternative] = spec.split("||").map((part) => part.trim());
    const choose = !includeDeuterocanon && alternative ? alternative : primary;
    const readings = choose.split(";").map((part) => parseReference(part.trim()));
    return includeDeuterocanon ? readings : readings.filter((reading) => !isDeuterocanonicalReading(reading));
  });
}

// ---------------------------------------------------------------- the library

const ADVENT_DAYS = [
  "Isaiah 2:1-5; Matthew 24:36-44",
  "Isaiah 11:1-10; Romans 15:4-13",
  "Isaiah 35; Matthew 11:2-11",
  "Isaiah 7:10-16; Matthew 1:18-25",
  "Isaiah 40:1-11; Mark 1:1-8",
  "Isaiah 61:1-4; John 1:6-8",
  "Jeremiah 33:14-16; Luke 21:25-36",
  "Baruch 5:1-9; Luke 3:1-6 || Malachi 3:1-4; Luke 3:1-6",
  "Zephaniah 3:14-20; Philippians 4:4-7",
  "Micah 5:2-5; Hebrews 10:5-10",
  "Genesis 3:8-15; Luke 1:26-38",
  "2 Samuel 7:1-16; Psalm 89:1-4",
  "Isaiah 9:2-7; Titus 2:11-14",
  "Isaiah 52:7-10; Hebrews 1:1-4",
  "Isaiah 62:1-5; Psalm 96",
  "Psalm 80; Luke 1:39-45",
  "1 Samuel 2:1-10; Luke 1:46-56",
  "Isaiah 40:25-31; Psalm 25",
  "Luke 1:5-25",
  "Luke 1:57-80",
  "Psalm 98; Isaiah 12",
  "Matthew 1:1-17",
  "John 1:1-18",
  "Luke 2:1-14",
  "Luke 2:15-20; Matthew 2:1-12",
];

const LENT_PSALMS = [6, 25, 32, 38, 42, 43, 62, 63, 77, 84, 86, 90, 91, 102, 103, 116, 121, 130, 139, 142, 143, 145, 23, 27, 31, 34, 40, 46, 71, 73, 22, 13, 17, 26];
const LENT_GOSPELS = [
  "Mark 1", "Mark 2", "Mark 3", "Mark 4", "Mark 5", "Mark 6", "Mark 7", "Mark 8", "Mark 9", "Mark 10",
  "Mark 11", "Mark 12", "Mark 13", "Luke 10", "John 3", "John 4", "John 5", "John 6", "Matthew 5", "Matthew 6",
  "Matthew 7", "Luke 14", "Luke 15", "John 9", "Matthew 16", "Matthew 17", "Matthew 18", "John 10", "Matthew 20",
  "Luke 18", "Luke 19", "John 11", "Matthew 25", "John 15",
];

const LENT_DAYS = [
  "Joel 2:12-18; Matthew 6:1-21",
  "Deuteronomy 30:15-20; Luke 9:22-25",
  "Isaiah 58:1-12; Psalm 51",
  "Isaiah 58:13-14; Luke 5:27-32",
  "Genesis 2:15-17; Genesis 3:1-7; Matthew 4:1-11",
  ...LENT_GOSPELS.map((gospel, index) => `Psalm ${LENT_PSALMS[index]}; ${gospel}`),
  "Matthew 21:1-11; Philippians 2:5-11",
  "Isaiah 42:1-9; John 12:1-11",
  "Isaiah 49:1-7; John 12:20-36",
  "Isaiah 50:4-9; Matthew 26:14-25",
  "Exodus 12:1-14; John 13:1-17",
  "Isaiah 52:13-53:12; John 18-19",
  "Lamentations 3:1-24; Matthew 27:57-66",
  "John 20:1-18; Luke 24:13-35",
];

function bibleInAYear(includeDeuterocanon) {
  const ot = chapterList(oldTestamentBooks({ includeDeuterocanon }).filter((item) => !["Psalms", "Proverbs"].includes(item.book)));
  const nt = chapterList(NT_BOOKS.map(([book, chapters]) => ({ book, chapters })));
  const wisdom = chapterList([{ book: "Psalms", chapters: 150 }, { book: "Proverbs", chapters: 31 }]);
  const otDays = spreadEvenly(ot, 365);
  const ntDays = spreadEvenly(nt, 365);
  const wisdomDays = spreadEvenly(wisdom, 365);
  return otDays.map((_, index) => [
    ...readingsFromChapters(otDays[index]),
    ...readingsFromChapters(ntDays[index]),
    ...readingsFromChapters(wisdomDays[index]),
  ]);
}

function gospelsIn30() {
  const gospels = chapterList(NT_BOOKS.slice(0, 4).map(([book, chapters]) => ({ book, chapters })));
  return spreadEvenly(gospels, 30).map(readingsFromChapters);
}

function psalmsAndProverbs() {
  return Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    const psalms = day <= 30 ? [day, day + 30, day + 60, day + 90, day + 120].map((chapter) => ({ book: "Psalms", chapter })) : [];
    return [
      ...psalms.flatMap((item) => readingsFromChapters([item])),
      ...readingsFromChapters([{ book: "Proverbs", chapter: day }]),
    ];
  });
}

function deuterocanonIn30() {
  const chapters = chapterList(DEUTEROCANON.map(({ book, chapters: count }) => ({ book, chapters: count })));
  return spreadEvenly(chapters, 30).map(readingsFromChapters);
}

/**
 * The library. `days(includeDeuterocanon)` returns an array of days, each an array of readings.
 * `catholicOnly` plans are offered in Catholic mode only. `season` plans suggest a start date.
 */
export const READING_PLANS = [
  {
    key: "bible-year",
    name: "Bible in a Year",
    description: "The whole Bible in 365 days: Old Testament, New Testament, and Psalms or Proverbs. In Catholic mode it includes Tobit, Judith, Wisdom, Sirach, Baruch and Maccabees.",
    length: 365,
    days: bibleInAYear,
  },
  {
    key: "gospels-30",
    name: "The Gospels in 30 Days",
    description: "Matthew, Mark, Luke and John, about three chapters a day.",
    length: 30,
    days: () => gospelsIn30(),
  },
  {
    key: "psalms-proverbs-31",
    name: "Psalms and Proverbs in a Month",
    description: "Five psalms and one chapter of Proverbs each day for 31 days.",
    length: 31,
    days: () => psalmsAndProverbs(),
  },
  {
    key: "advent",
    name: "Advent: Waiting for Christ",
    description: "25 days of prophecy and Gospel from December 1 to Christmas Day.",
    length: ADVENT_DAYS.length,
    season: "advent",
    days: (includeDeuterocanon) => daysFromSpecs(ADVENT_DAYS, includeDeuterocanon),
  },
  {
    key: "lent",
    name: "Lent: The Road to Easter",
    description: "From Ash Wednesday to Easter Sunday: a psalm and a Gospel reading each day, then Holy Week.",
    length: LENT_DAYS.length,
    season: "lent",
    days: (includeDeuterocanon) => daysFromSpecs(LENT_DAYS, includeDeuterocanon),
  },
  {
    key: "deuterocanon-30",
    name: "The Deuterocanonical Books in 30 Days",
    description: "Tobit, Judith, 1–2 Maccabees, Wisdom, Sirach and Baruch.",
    length: 30,
    catholicOnly: true,
    days: () => deuterocanonIn30(),
  },
];

const PLAN_BY_KEY = new Map(READING_PLANS.map((plan) => [plan.key, plan]));

export function readingPlan(key) {
  return PLAN_BY_KEY.get(String(key || "")) || null;
}

/** Plans offered to a tradition (Catholic-only plans are hidden elsewhere). */
export function plansForTradition(tradition) {
  const catholic = String(tradition || "").toLowerCase() === "catholic";
  return READING_PLANS.filter((plan) => catholic || !plan.catholicOnly);
}

const dayCache = new Map();

/** All days of a plan for a canon choice. */
export function planDays(key, { includeDeuterocanon = false } = {}) {
  const plan = readingPlan(key);
  if (!plan) return [];
  const cacheKey = `${key}:${includeDeuterocanon ? "dc" : "p"}`;
  if (!dayCache.has(cacheKey)) dayCache.set(cacheKey, plan.days(includeDeuterocanon));
  return dayCache.get(cacheKey);
}

/** Readings for one day (1-based) of a plan. */
export function planDayReadings(key, day, options = {}) {
  const days = planDays(key, options);
  return days[Number(day) - 1] || [];
}

export function dayCitation(readings) {
  return readings.map((reading) => reading.citation).join("; ");
}

// ---------------------------------------------------------------- schedule math

const DAY_MS = 86_400_000;

function dayValue(iso) {
  const text = String(iso || "").trim();
  if (!isRealIsoDate(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function isoFromValue(value) {
  return new Date(value * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(iso, count) {
  const value = dayValue(iso);
  return value == null ? "" : isoFromValue(value + Number(count || 0));
}

/**
 * The plan day scheduled for `today`: 1 on the start date, 0 before it,
 * and never more than the plan length.
 */
export function scheduledDay(startOn, today, length) {
  const start = dayValue(startOn);
  const now = dayValue(today);
  if (start == null || now == null) return 0;
  const day = now - start + 1;
  if (day < 1) return 0;
  return Math.min(day, Number(length));
}

/** The calendar date a plan day falls on. */
export function dateForDay(startOn, day) {
  return addDays(startOn, Number(day) - 1);
}

/**
 * Where a person stands in a plan.
 * @param {{ length: number, startOn: string, today: string, entries: Record<number, "done" | "skipped"> | Map<number, string> }} input
 */
export function planProgress({ length, startOn, today, entries }) {
  const map = entries instanceof Map ? entries : new Map(Object.entries(entries || {}).map(([day, status]) => [Number(day), status]));
  const total = Number(length);
  let done = 0;
  let skipped = 0;
  let nextDay = null;
  for (let day = 1; day <= total; day += 1) {
    const status = map.get(day);
    if (status === "done") done += 1;
    else if (status === "skipped") skipped += 1;
    else if (nextDay == null) nextDay = day;
  }
  const scheduled = scheduledDay(startOn, today, total);
  const missed = [];
  for (let day = 1; day < scheduled; day += 1) {
    if (!map.has(day)) missed.push(day);
  }
  const finished = nextDay == null;
  return {
    length: total,
    scheduledDay: scheduled,
    nextDay,
    done,
    skipped,
    missed,
    behind: missed.length,
    todayDone: scheduled > 0 && map.has(scheduled),
    notStarted: scheduled === 0,
    ahead: !finished && scheduled > 0 && nextDay > scheduled,
    finished,
    percent: total ? Math.round((done / total) * 100) : 0,
    endsOn: dateForDay(startOn, total),
  };
}

/** Days to mark skipped so the plan lines up with today's scheduled day. */
export function daysToSkip(progress) {
  return [...(progress?.missed || [])];
}

/**
 * New start date so the next unread day becomes today's reading
 * ("pick up where I left off" without marking anything skipped).
 */
export function rescheduledStart(today, nextDay) {
  if (!nextDay) return today;
  return addDays(today, -(Number(nextDay) - 1));
}

/**
 * Suggested start date. Advent starts December 1 (and ends on Christmas Day).
 * Lent starts on Ash Wednesday so the last day lands on Easter; in Orthodox mode
 * it is counted back from Pascha. Past seasons roll to next year.
 */
export function suggestedStart(plan, today, { tradition = "" } = {}) {
  if (!plan?.season) return today;
  const year = Number(String(today).slice(0, 4));
  if (plan.season === "advent") {
    const end = `${year}-12-25`;
    return today <= end ? `${year}-12-01` : `${year + 1}-12-01`;
  }
  const orthodox = String(tradition || "").toLowerCase() === "orthodox";
  const easter = (y) => (orthodox ? orthodoxEasterIso(y) : westernEasterIso(y));
  const startFor = (y) => addDays(easter(y), -(plan.length - 1));
  return today <= easter(year) ? startFor(year) : startFor(year + 1);
}
