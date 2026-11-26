/**
 * The Christian year computed in code: Easter (Computus), the seasons and the
 * major days shared across churches. No seed and no external API.
 *
 * Western dates follow the Gregorian Easter. Orthodox mode dates Pascha with
 * the Julian Computus and shows Great Lent and the Nativity Fast; fixed feasts
 * use the Revised Julian (new calendar) dates.
 *
 * Days are returned in the same shape as the Roman calendar rows from
 * server/utils/liturgicalCalendar.ts, so the calendar panel and the Today page
 * can show either one.
 */

const DAY_MS = 86_400_000;
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const ORDINALS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh"];

function pad(value) {
  return String(value).padStart(2, "0");
}

/** Whole days since 1970-01-01 (UTC), so daylight saving never shifts a date. */
export function dayNumber(year, month, day) {
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function isoFromDayNumber(value) {
  const date = new Date(value * DAY_MS);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function dayNumberFromIso(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
  if (!match) return null;
  return dayNumber(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** 0 = Sunday. 1970-01-01 was a Thursday. */
export function weekdayIndex(value) {
  return (((value + 4) % 7) + 7) % 7;
}

/** Western (Gregorian) Easter Sunday, as YYYY-MM-DD. Anonymous Gregorian algorithm. */
export function westernEasterIso(year) {
  return isoFromDayNumber(westernEasterDay(year));
}

export function westernEasterDay(year) {
  const y = Number(year);
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return dayNumber(y, month, day);
}

/** Orthodox Pascha (Julian Computus), converted to the Gregorian date, as YYYY-MM-DD. */
export function orthodoxEasterIso(year) {
  return isoFromDayNumber(orthodoxEasterDay(year));
}

export function orthodoxEasterDay(year) {
  const y = Number(year);
  const a = y % 4;
  const b = y % 7;
  const c = y % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  // Julian → Gregorian offset for March–May of this year (13 days from 1900 to 2099).
  const offset = Math.floor(y / 100) - Math.floor(y / 400) - 2;
  return dayNumber(y, month, day) + offset;
}

/** First Sunday of Advent: the fourth Sunday before Christmas (Nov 27 – Dec 3). */
export function firstSundayOfAdventDay(year) {
  const christmas = dayNumber(Number(year), 12, 25);
  const weekday = weekdayIndex(christmas);
  return christmas - (weekday === 0 ? 7 : weekday) - 21;
}

export function firstSundayOfAdventIso(year) {
  return isoFromDayNumber(firstSundayOfAdventDay(year));
}

function westernKeyDays(year) {
  const easter = westernEasterDay(year);
  const advent = firstSundayOfAdventDay(year);
  const epiphany = dayNumber(year, 1, 6);
  const epiphanyWeekday = weekdayIndex(epiphany);
  return {
    easter,
    advent,
    christmas: dayNumber(year, 12, 25),
    epiphany,
    baptism: epiphany + (7 - epiphanyWeekday),
    ashWednesday: easter - 46,
    firstSundayOfLent: easter - 42,
    palmSunday: easter - 7,
    pentecost: easter + 49,
  };
}

function orthodoxKeyDays(year) {
  const pascha = orthodoxEasterDay(year);
  return {
    pascha,
    cleanMonday: pascha - 48,
    palmSunday: pascha - 7,
    pentecost: pascha + 49,
    nativityFast: dayNumber(year, 11, 15),
    christmas: dayNumber(year, 12, 25),
    theophany: dayNumber(year, 1, 6),
  };
}

function westernMajorDays(year) {
  const k = westernKeyDays(year);
  const days = [
    [dayNumber(year, 1, 6), "Epiphany", "white"],
    [k.baptism, "Baptism of the Lord", "white"],
    [k.ashWednesday, "Ash Wednesday", "violet"],
    [k.palmSunday, "Palm Sunday", "red"],
    [k.easter - 3, "Maundy Thursday", "white"],
    [k.easter - 2, "Good Friday", "red"],
    [k.easter - 1, "Holy Saturday", null],
    [k.easter, "Easter Sunday", "white"],
    [k.easter + 39, "Ascension Day", "white"],
    [k.pentecost, "Pentecost", "red"],
    [k.pentecost + 7, "Trinity Sunday", "white"],
    [dayNumber(year, 11, 1), "All Saints' Day", "white"],
    [k.advent - 7, "Christ the King Sunday", "white"],
    [k.advent, "First Sunday of Advent", "violet"],
    [k.advent + 7, "Second Sunday of Advent", "violet"],
    [k.advent + 14, "Third Sunday of Advent", "violet"],
    [k.advent + 21, "Fourth Sunday of Advent", "violet"],
    [dayNumber(year, 12, 24), "Christmas Eve", "white"],
    [k.christmas, "Christmas Day", "white"],
  ];
  return days;
}

function orthodoxMajorDays(year) {
  const k = orthodoxKeyDays(year);
  return [
    [k.theophany, "Theophany", "white"],
    [k.cleanMonday, "Clean Monday: Great Lent begins", "violet"],
    [k.palmSunday - 1, "Lazarus Saturday", "white"],
    [k.palmSunday, "Palm Sunday", "green"],
    [k.pascha - 3, "Holy Thursday", "red"],
    [k.pascha - 2, "Holy Friday", "black"],
    [k.pascha - 1, "Holy Saturday", "white"],
    [k.pascha, "Pascha", "red"],
    [k.pascha + 39, "Ascension", "white"],
    [k.pentecost, "Pentecost", "green"],
    [dayNumber(year, 8, 6), "Transfiguration", "white"],
    [dayNumber(year, 9, 14), "Elevation of the Cross", "violet"],
    [k.nativityFast, "Nativity Fast begins", "red"],
    [k.christmas, "Nativity of Christ", "white"],
  ];
}

function westernSeason(value, year) {
  const k = westernKeyDays(year);
  if (value >= k.christmas) return { season: "christmas", week: 0, color: "white" };
  if (value >= k.advent) return { season: "advent", week: Math.floor((value - k.advent) / 7) + 1, color: "violet" };
  if (value < k.epiphany) return { season: "christmas", week: 0, color: "white" };
  if (value < k.ashWednesday) return { season: "ordinary", week: 0, color: "green" };
  if (value < k.firstSundayOfLent) return { season: "lent", week: 0, color: "violet" };
  if (value < k.palmSunday) {
    return { season: "lent", week: Math.floor((value - k.firstSundayOfLent) / 7) + 1, color: "violet" };
  }
  if (value < k.easter) return { season: "holy_week", week: 0, color: "violet" };
  if (value <= k.pentecost) return { season: "easter", week: Math.floor((value - k.easter) / 7) + 1, color: "white" };
  return { season: "ordinary", week: 0, color: "green" };
}

function orthodoxSeason(value, year) {
  const k = orthodoxKeyDays(year);
  if (value >= k.christmas) return { season: "christmas", week: 0, color: "white" };
  if (value >= k.nativityFast) return { season: "nativity_fast", week: 0, color: "red" };
  if (value < k.theophany) return { season: "christmas", week: 0, color: "white" };
  if (value < k.cleanMonday) return { season: "ordinary", week: 0, color: "green" };
  if (value < k.palmSunday - 1) {
    return { season: "great_lent", week: Math.floor((value - k.cleanMonday) / 7) + 1, color: "violet" };
  }
  if (value < k.pascha) return { season: "holy_week", week: 0, color: "violet" };
  if (value <= k.pentecost) return { season: "pascha", week: Math.floor((value - k.pascha) / 7) + 1, color: "red" };
  return { season: "ordinary", week: 0, color: "green" };
}

const SEASON_LABELS = {
  advent: "Advent",
  christmas: "Christmas",
  ordinary: "Ordinary Time",
  lent: "Lent",
  holy_week: "Holy Week",
  easter: "Easter",
  great_lent: "Great Lent",
  nativity_fast: "Nativity Fast",
  pascha: "Paschal season",
};

export function christianYearSeasonLabel(season) {
  return SEASON_LABELS[String(season || "").toLowerCase()] || "";
}

function plainTitle(weekday, season, week) {
  const name = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const label = christianYearSeasonLabel(season) || "Church year";
  if (weekday === "sunday" && week > 0 && week <= ORDINALS.length && ["advent", "lent", "easter", "great_lent", "pascha"].includes(season)) {
    return `${ORDINALS[week - 1]} Sunday of ${season === "pascha" ? "Pascha" : label}`;
  }
  return week > 0 ? `${name} · ${label}, week ${week}` : `${name} · ${label}`;
}

/**
 * One day of the Christian year.
 * @param {string} iso YYYY-MM-DD
 * @param {{ tradition?: string }} [options]
 */
export function christianYearDay(iso, { tradition = "christian" } = {}) {
  const value = dayNumberFromIso(iso);
  if (value == null) return null;
  const year = Number(String(iso).slice(0, 4));
  const orthodox = String(tradition || "").toLowerCase() === "orthodox";
  const { season, week, color: seasonColor } = orthodox ? orthodoxSeason(value, year) : westernSeason(value, year);
  const weekday = WEEKDAYS[weekdayIndex(value)];
  const majors = (orthodox ? orthodoxMajorDays(year) : westernMajorDays(year)).filter(([day]) => day === value);

  const celebrations = majors.length
    ? majors.map(([, title, color], index) => ({
      sortOrder: index,
      title,
      displayTitle: title,
      rank: null,
      rankNum: null,
      color,
      major: true,
    }))
    : [
      {
        sortOrder: 0,
        title: "",
        displayTitle: plainTitle(weekday, season, week),
        rank: null,
        rankNum: null,
        color: seasonColor,
        major: false,
      },
    ];

  return {
    date: isoFromDayNumber(value),
    season,
    seasonWeek: week,
    weekday,
    celebrations,
    indicatorColor: majors.find(([, , color]) => color)?.[2] || null,
  };
}

/** Every day from `start` to `end` inclusive (YYYY-MM-DD). */
export function christianYearRange(start, end, options = {}) {
  const from = dayNumberFromIso(start);
  const to = dayNumberFromIso(end);
  if (from == null || to == null || to < from) return [];
  const days = [];
  for (let value = from; value <= to && days.length < 400; value += 1) {
    days.push(christianYearDay(isoFromDayNumber(value), options));
  }
  return days;
}
