<template>
  <div
    class="calendar-frame"
    :class="{ 'calendar-frame--collapsed': panelCollapsed }"
  >
    <button
      v-if="panelCollapsed"
      type="button"
      class="calendar-frame__rail"
      title="Open calendar panel"
      aria-label="Open calendar panel"
      @click="collapsed = false"
    >
      <span class="calendar-frame__rail-label">Calendar</span>
      <span aria-hidden="true">‹</span>
    </button>

    <aside
      class="calendar-frame__panel overflow-hidden rounded-lg border border-base-300 bg-base-100"
      :class="{ 'calendar-frame__panel--open': !panelCollapsed }"
      :aria-hidden="panelCollapsed"
    >
      <div class="border-b border-gray-200 px-3 py-3 sm:px-4 dark:border-white/10">
      <div class="mb-3 flex items-center gap-2">
        <button
          type="button"
          class="calendar-frame__toggle"
          title="Close calendar panel"
          aria-label="Close calendar panel"
          :aria-expanded="!collapsed"
          @click="collapsed = true"
        >
          ›
        </button>
        <div class="flex min-w-0 flex-1 items-center justify-between gap-2">
          <button
            type="button"
            class="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200"
            aria-label="Previous month"
            @click="changeMonth(-1)"
          >
            ‹
          </button>
          <div class="min-w-0 text-center">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ monthLabel(viewYear, viewMonth) }}
            </h2>
            <button
              v-if="!isCurrentMonth"
              type="button"
              class="mt-0.5 text-[11px] font-medium text-primary hover:text-primary/80"
              @click="goToCurrentMonth"
            >
              Today
            </button>
          </div>
          <button
            type="button"
            class="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200"
            aria-label="Next month"
            @click="changeMonth(1)"
          >
            ›
          </button>
        </div>
      </div>

      <div class="grid grid-cols-7 text-center text-[11px] font-medium text-gray-500 dark:text-gray-400">
        <span v-for="label in weekdayLabels" :key="label">{{ label }}</span>
      </div>

      <div class="mt-1 space-y-0.5" role="grid" aria-label="Liturgical month">
        <div
          v-for="week in monthWeeks"
          :key="week.sunday"
          role="row"
          class="grid cursor-pointer grid-cols-7 rounded-md text-center"
          :class="weekRowTone(week)"
          :aria-selected="week.sunday === selectedWeekStart"
          :aria-label="weekRowLabel(week)"
          @click="selectWeek(week.sunday)"
        >
          <div
            v-for="(cell, index) in week.cells"
            :key="cell?.iso || `${week.sunday}-pad-${index}`"
            class="flex justify-center py-0.5"
            role="gridcell"
          >
            <button
              v-if="cell"
              type="button"
              class="flex h-9 w-9 flex-col items-center justify-center rounded-md"
              :class="cellTone(cell)"
              :aria-current="cell.iso === today ? 'date' : undefined"
              :aria-label="dayButtonLabel(cell)"
              @click.stop="selectWeek(cell.iso)"
            >
              <span class="text-xs tabular-nums leading-none">{{ cell.day }}</span>
              <span
                class="mt-0.5 size-1.5 rounded-full"
                :class="cell.indicatorColor ? liturgicalColorClass(cell.indicatorColor) : 'bg-transparent'"
                :title="cell.indicatorColor || undefined"
              />
            </button>
          </div>
        </div>
      </div>

      <p
        v-if="monthMessage"
        class="mt-3 text-xs text-gray-500 dark:text-gray-400"
      >
        {{ monthMessage }}
      </p>
    </div>

    <div class="px-3 py-3 sm:px-4">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ isSelectedCurrentWeek ? "This week" : "Selected week" }}
      </h3>
      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        Sunday–Saturday
        <span v-if="weekRangeLabel"> · {{ weekRangeLabel }}</span>
      </p>

      <LoadErrorPanel
        v-if="loadError"
        class="mt-3"
        :message="loadError"
        @retry="loadAll"
      />

      <p v-else-if="loading || weekLoading" class="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Loading liturgical days...
      </p>

      <p v-else-if="weekMessage" class="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {{ weekMessage }}
      </p>

      <ol v-else class="mt-3 space-y-3">
        <li v-for="day in weekDays" :key="day.date">
          <p
            class="text-xs font-semibold"
            :class="day.date === today ? 'text-primary' : 'text-base-content/80'"
          >
            {{ formatDayHeading(day.date, day.weekday) }}
          </p>
          <ul class="mt-1 space-y-1.5">
            <li
              v-for="celebration in day.celebrations"
              :key="`${day.date}-${celebration.sortOrder}`"
              class="flex items-start gap-2"
            >
              <span
                class="mt-1.5 size-2 shrink-0 rounded-full"
                :class="liturgicalColorClass(celebration.color)"
                :title="celebration.color || 'liturgical color'"
              />
              <div class="min-w-0">
                <p class="text-sm leading-5 text-gray-900 dark:text-white">
                  {{ celebration.displayTitle }}
                </p>
                <p class="text-[11px] text-gray-500 dark:text-gray-400">
                  <span v-if="celebration.rank">{{ capitalizeWord(celebration.rank) }}</span>
                  <span v-if="celebration.rank && celebration.color"> · </span>
                  <span v-if="celebration.color">{{ capitalizeWord(celebration.color) }}</span>
                </p>
              </div>
            </li>
          </ul>
        </li>
      </ol>
    </div>
    </aside>
  </div>
</template>

<script setup>
import { parseFetchError } from "~/utils/parseFetchError";
import {
  addDaysIso,
  capitalizeWord,
  formatDayHeading,
  formatIsoDate,
  formatWeekRange,
  isoDatesInclusive,
  liturgicalColorClass,
  monthLabel,
  parseIsoDate,
  shiftYearMonth,
  sundaySaturdayBounds,
  todayIsoDate,
} from "~/utils/liturgicalCalendar";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const collapsed = ref(false);
const isDesktop = ref(false);

const panelCollapsed = computed(() => collapsed.value && isDesktop.value);

const today = todayIsoDate();
const todayParts = today.split("-");
const currentYear = Number(todayParts[0]);
const currentMonth = Number(todayParts[1]);

const viewYear = ref(currentYear);
const viewMonth = ref(currentMonth);
const selectedDate = ref(today);
const loading = ref(true);
const weekLoading = ref(false);
const loadError = ref("");
const monthDays = ref([]);
const monthMessage = ref("");
const weekDays = ref([]);
const weekStart = ref("");
const weekEnd = ref("");
const weekMessage = ref("");

const isCurrentMonth = computed(
  () => viewYear.value === currentYear && viewMonth.value === currentMonth,
);

const selectedBounds = computed(() => sundaySaturdayBounds(selectedDate.value));

const selectedWeekStart = computed(() => selectedBounds.value?.start || "");

const isSelectedCurrentWeek = computed(() => {
  const todayBounds = sundaySaturdayBounds(today);
  return Boolean(todayBounds && selectedWeekStart.value === todayBounds.start);
});

const weekRangeLabel = computed(() => {
  const start = weekStart.value || selectedBounds.value?.start || "";
  const end = weekEnd.value || selectedBounds.value?.end || "";
  return formatWeekRange(start, end);
});

const weekDateSet = computed(() => {
  const bounds = selectedBounds.value;
  if (!bounds) return new Set();
  return new Set(isoDatesInclusive(bounds.start, bounds.end));
});

const daysByDate = computed(() => {
  const map = new Map();
  for (const day of monthDays.value) map.set(day.date, day);
  return map;
});

const monthWeeks = computed(() => {
  const firstIso = formatIsoDate(viewYear.value, viewMonth.value, 1);
  const lastDay = new Date(viewYear.value, viewMonth.value, 0).getDate();
  const lastIso = formatIsoDate(viewYear.value, viewMonth.value, lastDay);
  const firstBounds = sundaySaturdayBounds(firstIso);
  if (!firstBounds) return [];

  const weeks = [];
  let cursor = firstBounds.start;
  for (let i = 0; i < 6; i += 1) {
    const bounds = sundaySaturdayBounds(cursor);
    if (!bounds) break;
    const cells = isoDatesInclusive(bounds.start, bounds.end).map((iso) => {
      const parts = parseIsoDate(iso);
      const inMonth = Boolean(
        parts && parts.year === viewYear.value && parts.month === viewMonth.value,
      );
      if (!inMonth) return null;
      return {
        day: parts.day,
        iso,
        indicatorColor: daysByDate.value.get(iso)?.indicatorColor || "",
      };
    });
    weeks.push({ sunday: bounds.start, saturday: bounds.end, cells });
    if (bounds.end >= lastIso) break;
    cursor = addDaysIso(bounds.end, 1);
    if (!cursor) break;
  }
  return weeks;
});

function weekRowTone(week) {
  if (week.sunday === selectedWeekStart.value) {
    return "bg-primary/10 ring-1 ring-primary/25";
  }
  return "hover:bg-gray-50 dark:hover:bg-white/5";
}

function cellTone(cell) {
  if (cell.iso === today) {
    return "bg-primary text-primary-content";
  }
  if (weekDateSet.value.has(cell.iso)) {
    return "text-gray-900 dark:text-white";
  }
  return "text-gray-700 dark:text-gray-300";
}

function weekRowLabel(week) {
  const range = formatWeekRange(week.sunday, week.saturday);
  return range ? `Week of ${range}` : "Select week";
}

function dayButtonLabel(cell) {
  const parts = parseIsoDate(cell.iso);
  if (!parts) return `Select ${cell.day}`;
  return `Select week containing ${parts.day} ${monthLabel(parts.year, parts.month)}`;
}

async function loadMonth() {
  const data = await $fetch("/api/spiritual/calendar", {
    query: { year: viewYear.value, month: viewMonth.value },
  });
  monthDays.value = data.days || [];
  monthMessage.value = data.seeded ? "" : data.message || "";
}

async function loadWeek(date = selectedDate.value) {
  const data = await $fetch("/api/spiritual/week", {
    query: { date },
  });
  weekDays.value = data.days || [];
  weekStart.value = data.start || "";
  weekEnd.value = data.end || "";
  weekMessage.value = data.seeded ? "" : data.message || "";
}

async function selectWeek(iso) {
  if (!iso || !sundaySaturdayBounds(iso)) return;
  selectedDate.value = iso;
  weekLoading.value = true;
  loadError.value = "";
  try {
    await loadWeek(iso);
  } catch (error) {
    loadError.value = parseFetchError(error, "Could not load that week's liturgical events.");
    weekDays.value = [];
    weekMessage.value = "";
  } finally {
    weekLoading.value = false;
  }
}

async function loadAll() {
  loading.value = true;
  loadError.value = "";
  try {
    await Promise.all([loadMonth(), loadWeek()]);
  } catch (error) {
    loadError.value = parseFetchError(error, "Could not load the liturgical calendar.");
    monthDays.value = [];
    weekDays.value = [];
    weekMessage.value = "";
  } finally {
    loading.value = false;
  }
}

async function changeMonth(delta) {
  const next = shiftYearMonth(viewYear.value, viewMonth.value, delta);
  viewYear.value = next.year;
  viewMonth.value = next.month;
  try {
    await loadMonth();
  } catch (error) {
    monthDays.value = [];
    monthMessage.value = parseFetchError(error, "Could not load that month.");
  }
}

async function goToCurrentMonth() {
  viewYear.value = currentYear;
  viewMonth.value = currentMonth;
  try {
    await loadMonth();
  } catch (error) {
    monthDays.value = [];
    monthMessage.value = parseFetchError(error, "Could not load that month.");
  }
}

let desktopMqCleanup = null;

onMounted(() => {
  const mq = window.matchMedia("(min-width: 1024px)");
  const syncDesktop = () => {
    isDesktop.value = mq.matches;
  };
  syncDesktop();
  mq.addEventListener("change", syncDesktop);
  desktopMqCleanup = () => mq.removeEventListener("change", syncDesktop);
  void loadAll();
});

onUnmounted(() => {
  desktopMqCleanup?.();
});
</script>

<style scoped>
.calendar-frame {
  position: relative;
  width: 100%;
}

.calendar-frame__toggle,
.calendar-frame__rail {
  display: none;
  align-items: center;
  justify-content: center;
  min-height: unset !important;
  min-width: unset !important;
  height: 1.75rem;
  width: 1.75rem;
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--color-base-content, #151616) 16%, transparent);
  border-radius: 0.375rem;
  background: var(--color-base-100, #ffffff);
  color: var(--color-base-content, #151616);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.calendar-frame__toggle:hover,
.calendar-frame__rail:hover {
  background: color-mix(in srgb, var(--color-base-content, #151616) 6%, transparent);
}

.calendar-frame__rail-label {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

@media (min-width: 1024px) {
  .calendar-frame {
    width: 22rem;
    margin-right: 0;
    overflow: hidden;
    transition: width 0.22s ease;
  }

  .calendar-frame--collapsed {
    width: 2.25rem;
  }

  .calendar-frame__toggle {
    display: inline-flex;
  }

  .calendar-frame__rail {
    display: inline-flex;
    position: relative;
    top: 0;
    right: 0;
    z-index: 5;
    width: 2.25rem;
    height: auto;
    min-height: 5.5rem;
    margin-right: 0;
    flex-direction: column;
    gap: 0.65rem;
    border-radius: 0.5rem 0 0 0.5rem;
    border-right: none;
    padding: 0.65rem 0.25rem;
    box-shadow: -2px 2px 10px color-mix(in srgb, var(--color-base-content, #151616) 10%, transparent);
  }

  .calendar-frame__panel {
    width: 22rem;
    margin-right: 0;
    border-radius: 0.5rem 0 0 0.5rem;
    border-right-width: 0;
    transform: translateX(105%);
    transition: transform 0.22s ease;
    pointer-events: none;
  }

  .calendar-frame--collapsed .calendar-frame__panel {
    position: absolute;
    top: 0;
    right: 0;
  }

  .calendar-frame__panel--open {
    transform: translateX(0);
    pointer-events: auto;
  }
}
</style>
