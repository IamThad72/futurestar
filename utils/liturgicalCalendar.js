/** Default Inadiutorium English General Roman catalog. */
export const LITURGICAL_CALENDAR_ID = "en-default";

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function parseIsoDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function formatIsoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function todayIsoDate(now = new Date()) {
  return formatIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function addDaysIso(iso, days) {
  const parts = parseIsoDate(iso);
  if (!parts) return "";
  const date = new Date(parts.year, parts.month - 1, parts.day + Number(days || 0));
  return formatIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Sunday–Saturday week containing `isoDate` (Sunday start). */
export function sundaySaturdayBounds(isoDate) {
  const parts = parseIsoDate(isoDate);
  if (!parts) return null;
  const date = new Date(parts.year, parts.month - 1, parts.day);
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: formatIsoDate(start.getFullYear(), start.getMonth() + 1, start.getDate()),
    end: formatIsoDate(end.getFullYear(), end.getMonth() + 1, end.getDate()),
  };
}

export function isoDatesInclusive(startIso, endIso) {
  if (!parseIsoDate(startIso) || !parseIsoDate(endIso)) return [];
  const dates = [];
  let current = startIso;
  for (let i = 0; i < 32 && current; i += 1) {
    dates.push(current);
    if (current === endIso) break;
    current = addDaysIso(current, 1);
  }
  return dates;
}

export function shiftYearMonth(year, month, delta) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function monthLabel(year, month) {
  return `${MONTH_LONG[month - 1] || ""} ${year}`.trim();
}

export function formatWeekRange(startIso, endIso) {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end) return "";
  if (start.month === end.month && start.year === end.year) {
    return `${start.day}–${end.day} ${MONTH_SHORT[start.month - 1]} ${start.year}`;
  }
  if (start.year === end.year) {
    return `${start.day} ${MONTH_SHORT[start.month - 1]} – ${end.day} ${MONTH_SHORT[end.month - 1]} ${start.year}`;
  }
  return `${start.day} ${MONTH_SHORT[start.month - 1]} ${start.year} – ${end.day} ${MONTH_SHORT[end.month - 1]} ${end.year}`;
}

export function formatDayHeading(iso, weekday) {
  const parts = parseIsoDate(iso);
  const name = capitalizeWord(weekday || "Day");
  if (!parts) return name;
  return `${name}, ${parts.day} ${MONTH_LONG[parts.month - 1]}`;
}

export function capitalizeWord(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function seasonLabel(season) {
  switch (String(season || "").toLowerCase()) {
    case "ordinary":
      return "Ordinary Time";
    case "advent":
      return "Advent";
    case "christmas":
      return "Christmas";
    case "lent":
      return "Lent";
    case "easter":
      return "Easter";
    default:
      return capitalizeWord(season) || "Liturgical season";
  }
}

export function displayCelebrationTitle(celebration, day) {
  const title = String(celebration?.title || "").trim();
  if (title) return title;
  const weekday = capitalizeWord(day?.weekday || "Weekday");
  const season = seasonLabel(day?.season);
  const week = Number(day?.seasonWeek ?? day?.season_week);
  if (Number.isFinite(week) && week > 0) {
    return `${weekday} · ${season}, week ${week}`;
  }
  return `${weekday} · ${season}`;
}

export function isMajorCelebration(celebration) {
  const rank = String(celebration?.rank || "").toLowerCase();
  if (/\bsolemnity\b|\bfeast\b|\bsunday\b/.test(rank)) return true;
  const rankNum = Number(celebration?.rankNum ?? celebration?.rank_num);
  return Number.isFinite(rankNum) && rankNum <= 2.8;
}

export function liturgicalColorClass(color) {
  switch (String(color || "").toLowerCase()) {
    case "green":
      return "bg-green-600";
    case "white":
      return "bg-stone-100 ring-1 ring-stone-400 dark:bg-stone-200 dark:ring-stone-500";
    case "red":
      return "bg-red-600";
    case "violet":
    case "purple":
      return "bg-violet-700";
    case "rose":
    case "pink":
      return "bg-rose-400";
    case "black":
      return "bg-neutral-800";
    default:
      return "bg-gray-400";
  }
}
