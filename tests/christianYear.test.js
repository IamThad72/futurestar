import assert from "node:assert/strict";
import test from "node:test";
import {
  christianYearDay,
  christianYearRange,
  firstSundayOfAdventIso,
  orthodoxEasterIso,
  westernEasterIso,
} from "../utils/christianYear.js";
import { seasonLabel } from "../utils/liturgicalCalendar.js";

test("western Easter matches published dates", () => {
  const known = {
    1961: "1961-04-02",
    2000: "2000-04-23",
    2008: "2008-03-23",
    2011: "2011-04-24",
    2019: "2019-04-21",
    2024: "2024-03-31",
    2025: "2025-04-20",
    2026: "2026-04-05",
    2027: "2027-03-28",
    2028: "2028-04-16",
    2038: "2038-04-25",
    2285: "2285-03-22",
  };
  for (const [year, iso] of Object.entries(known)) {
    assert.equal(westernEasterIso(Number(year)), iso, `Easter ${year}`);
  }
});

test("Orthodox Pascha matches published dates", () => {
  const known = {
    2010: "2010-04-04",
    2021: "2021-05-02",
    2023: "2023-04-16",
    2024: "2024-05-05",
    2025: "2025-04-20",
    2026: "2026-04-12",
    2027: "2027-05-02",
  };
  for (const [year, iso] of Object.entries(known)) {
    assert.equal(orthodoxEasterIso(Number(year)), iso, `Pascha ${year}`);
  }
});

test("first Sunday of Advent falls between Nov 27 and Dec 3", () => {
  assert.equal(firstSundayOfAdventIso(2023), "2023-12-03");
  assert.equal(firstSundayOfAdventIso(2024), "2024-12-01");
  assert.equal(firstSundayOfAdventIso(2025), "2025-11-30");
  assert.equal(firstSundayOfAdventIso(2026), "2026-11-29");
  assert.equal(firstSundayOfAdventIso(2027), "2027-11-28");
  assert.equal(firstSundayOfAdventIso(2022), "2022-11-27");
});

function titles(day) {
  return day.celebrations.map((item) => item.displayTitle);
}

test("major days of the 2026 church year", () => {
  const expected = {
    "2026-01-06": "Epiphany",
    "2026-01-11": "Baptism of the Lord",
    "2026-02-18": "Ash Wednesday",
    "2026-03-29": "Palm Sunday",
    "2026-04-02": "Maundy Thursday",
    "2026-04-03": "Good Friday",
    "2026-04-05": "Easter Sunday",
    "2026-05-14": "Ascension Day",
    "2026-05-24": "Pentecost",
    "2026-05-31": "Trinity Sunday",
    "2026-11-22": "Christ the King Sunday",
    "2026-11-29": "First Sunday of Advent",
    "2026-12-20": "Fourth Sunday of Advent",
    "2026-12-24": "Christmas Eve",
    "2026-12-25": "Christmas Day",
  };
  for (const [iso, title] of Object.entries(expected)) {
    const day = christianYearDay(iso);
    assert.ok(titles(day).includes(title), `${iso} should be ${title}, got ${titles(day)}`);
    assert.equal(day.celebrations[0].major, true);
  }
});

test("seasons of the 2026 church year", () => {
  const cases = [
    ["2026-01-02", "christmas", 0],
    ["2026-01-20", "ordinary", 0],
    ["2026-02-17", "ordinary", 0],
    ["2026-02-18", "lent", 0],
    ["2026-02-22", "lent", 1],
    ["2026-03-28", "lent", 5],
    ["2026-03-30", "holy_week", 0],
    ["2026-04-05", "easter", 1],
    ["2026-04-12", "easter", 2],
    ["2026-05-24", "easter", 8],
    ["2026-05-25", "ordinary", 0],
    ["2026-11-28", "ordinary", 0],
    ["2026-11-29", "advent", 1],
    ["2026-12-21", "advent", 4],
    ["2026-12-31", "christmas", 0],
  ];
  for (const [iso, season, week] of cases) {
    const day = christianYearDay(iso);
    assert.equal(day.season, season, `${iso} season`);
    assert.equal(day.seasonWeek, week, `${iso} week`);
  }
});

test("plain days carry the season name and color, and no Roman rank", () => {
  const day = christianYearDay("2026-03-04");
  assert.equal(day.weekday, "wednesday");
  assert.equal(day.celebrations.length, 1);
  assert.equal(day.celebrations[0].major, false);
  assert.equal(day.celebrations[0].rank, null);
  assert.equal(day.celebrations[0].color, "violet");
  assert.equal(day.celebrations[0].displayTitle, "Wednesday · Lent, week 2");
  assert.equal(day.indicatorColor, null);
  assert.equal(christianYearDay("2026-03-08").celebrations[0].displayTitle, "Third Sunday of Lent");
});

test("Orthodox mode dates Great Lent and the Nativity Fast", () => {
  const cleanMonday = christianYearDay("2026-02-23", { tradition: "orthodox" });
  assert.equal(cleanMonday.season, "great_lent");
  assert.ok(titles(cleanMonday)[0].startsWith("Clean Monday"));
  assert.ok(titles(christianYearDay("2026-04-12", { tradition: "orthodox" })).includes("Pascha"));
  assert.equal(christianYearDay("2026-04-05", { tradition: "orthodox" }).season, "holy_week");
  assert.equal(christianYearDay("2026-11-20", { tradition: "orthodox" }).season, "nativity_fast");
  assert.equal(seasonLabel("nativity_fast"), "Nativity Fast");
  assert.equal(seasonLabel("holy_week"), "Holy Week");
  assert.equal(seasonLabel("ordinary"), "Ordinary Time");
});

test("a range returns one day per date, in order", () => {
  const days = christianYearRange("2026-11-01", "2026-11-30");
  assert.equal(days.length, 30);
  assert.equal(days[0].date, "2026-11-01");
  assert.equal(days[29].date, "2026-11-30");
  assert.ok(titles(days[0]).includes("All Saints' Day"));
  assert.deepEqual(christianYearRange("2026-12-02", "2026-12-01"), []);
  assert.equal(christianYearDay("not-a-date"), null);
});
