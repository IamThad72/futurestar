import {
  displayCelebrationTitle,
  isMajorCelebration,
  LITURGICAL_CALENDAR_ID,
  parseIsoDate,
  sundaySaturdayBounds,
} from "~/utils/liturgicalCalendar";

export { sundaySaturdayBounds };

type DbClient = {
  query: (queryText: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};

export type LiturgicalCelebrationDto = {
  sortOrder: number;
  title: string;
  displayTitle: string;
  rank: string | null;
  rankNum: number | null;
  color: string | null;
  major: boolean;
};

export type LiturgicalDayDto = {
  date: string;
  season: string;
  seasonWeek: number;
  weekday: string;
  celebrations: LiturgicalCelebrationDto[];
  indicatorColor: string | null;
};

export const DEFAULT_LITURGICAL_CALENDAR_ID = LITURGICAL_CALENDAR_ID;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string) {
  return ISO_DATE.test(value) && Boolean(parseIsoDate(value));
}

export function isCatalogUnavailable(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code || "")
      : "";
  return code === "42P01" || code === "42703";
}

export function emptyCatalogMessage(kind: "month" | "week") {
  return kind === "week"
    ? "No liturgical events are seeded for this week."
    : "This month is not in the liturgical catalog yet.";
}

export function monthDateBounds(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate();
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

function mapCelebration(
  row: {
    title?: string | null;
    rank?: string | null;
    rank_num?: string | number | null;
    color?: string | null;
    sort_order?: string | number | null;
  },
  day: { weekday: string; season: string; seasonWeek: number },
): LiturgicalCelebrationDto {
  const rankNumRaw = row.rank_num == null ? null : Number(row.rank_num);
  const celebration = {
    sortOrder: Number(row.sort_order) || 0,
    title: String(row.title || ""),
    rank: row.rank == null ? null : String(row.rank),
    rankNum: Number.isFinite(rankNumRaw) ? rankNumRaw : null,
    color: row.color == null || !String(row.color).trim() ? null : String(row.color).trim(),
  };
  const major = isMajorCelebration(celebration);
  return {
    ...celebration,
    displayTitle: displayCelebrationTitle(celebration, day),
    major,
  };
}

export async function listLiturgicalRange(
  client: DbClient,
  options: { calendarId?: string; start: string; end: string },
): Promise<LiturgicalDayDto[]> {
  const calendarId = options.calendarId || DEFAULT_LITURGICAL_CALENDAR_ID;
  const { rows } = await client.query(
    `SELECT
       to_char(d.day_date, 'YYYY-MM-DD') AS day_date,
       d.season,
       d.season_week,
       d.weekday,
       c.sort_order,
       c.title,
       c.rank,
       c.rank_num,
       c.color
     FROM liturgical_days d
     LEFT JOIN liturgical_celebrations c
       ON c.calendar_id = d.calendar_id AND c.day_date = d.day_date
     WHERE d.calendar_id = $1
       AND d.day_date >= $2::date
       AND d.day_date <= $3::date
     ORDER BY d.day_date, c.sort_order NULLS LAST`,
    [calendarId, options.start, options.end],
  );

  const days = new Map<string, LiturgicalDayDto>();
  for (const row of rows) {
    const date = String(row.day_date);
    let day = days.get(date);
    if (!day) {
      day = {
        date,
        season: String(row.season || ""),
        seasonWeek: Number(row.season_week) || 0,
        weekday: String(row.weekday || ""),
        celebrations: [],
        indicatorColor: null,
      };
      days.set(date, day);
    }
    if (row.sort_order == null && row.title == null && row.rank == null) continue;
    const celebration = mapCelebration(row, day);
    day.celebrations.push(celebration);
    if (!day.indicatorColor && celebration.major && celebration.color) {
      day.indicatorColor = celebration.color;
    }
  }
  for (const day of days.values()) {
    if (day.celebrations.length) continue;
    day.celebrations.push({
      sortOrder: 0,
      title: "",
      displayTitle: displayCelebrationTitle({}, day),
      rank: "ferial",
      rankNum: null,
      color: null,
      major: false,
    });
  }
  return [...days.values()];
}
