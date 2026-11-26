<template>
  <div class="min-w-0 max-w-full space-y-6">
    <p v-if="loadError" class="text-sm text-red-600">{{ loadError }}</p>
    <div
      v-else-if="unavailableMessage"
      class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      {{ unavailableMessage }}
    </div>
    <div v-else-if="loading && !library.length" class="app-card px-4 py-6 text-sm text-gray-700">Loading plans…</div>

    <!-- One plan -->
    <template v-else-if="selectedId">
      <button type="button" class="training-chip btn btn-ghost btn-sm rounded-full" @click="closePlan">
        <AppIcon name="chevron-back" :size="18" />
        All plans
      </button>
      <div v-if="!detail" class="app-card px-4 py-6 text-sm text-gray-700">
        {{ detailError || "Loading plan…" }}
      </div>
      <template v-else>
        <section class="app-card min-w-0 px-4 py-4">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h2 class="text-base font-semibold text-gray-900">{{ detail.plan.name }}</h2>
            <span class="sl-caption">{{ statusLabel(detail.plan) }}</span>
          </div>
          <p class="mt-1 text-sm text-muted">{{ detail.description }}</p>
          <div class="plan-progress mt-3" role="progressbar" :aria-valuenow="detail.plan.progress.percent" aria-valuemin="0" aria-valuemax="100">
            <span :style="{ width: `${detail.plan.progress.percent}%` }" />
          </div>
          <p class="mt-2 text-sm text-gray-800">
            {{ detail.plan.progress.done }} of {{ detail.plan.length }} days read<span v-if="detail.plan.progress.skipped"> · {{ detail.plan.progress.skipped }} skipped</span>
            · started {{ formatDate(detail.plan.start_on) }}<span v-if="!detail.plan.progress.finished"> · ends {{ formatDate(detail.plan.progress.endsOn) }}</span>
          </p>

          <div v-if="detail.plan.status === 'active' && detail.plan.progress.behind" class="mt-4 rounded-md bg-gray-50 px-3 py-3">
            <p class="text-sm text-gray-800">
              {{ detail.plan.progress.behind }} earlier {{ detail.plan.progress.behind === 1 ? "day is" : "days are" }} unread. Pick whatever helps you keep going:
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
              <button type="button" class="training-chip btn btn-ghost btn-xs rounded-full" @click="openDay(detail.plan.progress.missed[0])">
                Catch up from day {{ detail.plan.progress.missed[0] }}
              </button>
              <button type="button" class="training-chip btn btn-ghost btn-xs rounded-full" :disabled="busy" @click="planAction('skip_missed')">
                Skip to today
              </button>
              <button type="button" class="training-chip btn btn-ghost btn-xs rounded-full" :disabled="busy" @click="planAction('reschedule')">
                Shift my dates
              </button>
            </div>
            <p class="mt-2 text-xs text-gray-700">
              Skip to today marks the missed days skipped. Shift my dates moves the plan so day {{ detail.plan.progress.nextDay }} is today.
            </p>
          </div>
        </section>

        <section v-if="currentDay" class="app-card min-w-0 px-4 py-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0">
              <h2 class="text-sm font-semibold text-gray-900">Day {{ currentDay }} of {{ detail.plan.length }}</h2>
              <p class="text-xs text-gray-700">
                {{ formatDate(dayInfo?.date, true) }}<span v-if="dayInfo?.status"> · {{ dayInfo.status === "done" ? "Read" : "Skipped" }}</span>
              </p>
            </div>
            <div class="flex gap-1">
              <button type="button" class="training-chip btn btn-ghost btn-xs rounded-full" :disabled="currentDay <= 1" aria-label="Previous day" @click="openDay(currentDay - 1)">
                <AppIcon name="chevron-back" :size="18" />
              </button>
              <button type="button" class="training-chip btn btn-ghost btn-xs rounded-full" :disabled="currentDay >= detail.plan.length" aria-label="Next day" @click="openDay(currentDay + 1)">
                <AppIcon name="chevron-forward" :size="18" />
              </button>
            </div>
          </div>
          <p class="sl-scripture mt-3">{{ dayInfo?.citation }}</p>
          <p v-if="catalogNotice" class="mt-1 text-xs text-gray-700">{{ catalogNotice }}</p>

          <p v-if="textError" class="mt-3 text-sm text-red-600">{{ textError }}</p>
          <p v-else-if="textLoading" class="mt-3 text-sm text-gray-700">Loading the text…</p>
          <p v-else-if="catalogMessage" class="mt-3 text-sm text-amber-700 dark:text-amber-400">{{ catalogMessage }}</p>
          <div v-else class="mt-4 space-y-6">
            <article v-for="reading in readings" :key="reading.citation" class="min-w-0">
              <h3 class="text-sm font-semibold text-gray-900">{{ reading.citation }}</h3>
              <p class="text-xs text-gray-700">
                {{ reading.translation }}<span v-if="reading.fallback"> (not in your translation, so shown from the {{ reading.translation }})</span>
              </p>
              <p v-if="!reading.verses.length" class="mt-2 text-sm text-gray-700">This passage is not loaded in the Bible catalog yet.</p>
              <div v-else class="plan-text mt-2">
                <template v-for="(verse, index) in reading.verses" :key="`${verse.chapter}:${verse.verse}`">
                  <span v-if="spansChapters(reading) && (index === 0 || verse.chapter !== reading.verses[index - 1].chapter)" class="plan-text__chapter">Chapter {{ verse.chapter }}</span>
                  <sup class="plan-text__verse">{{ verse.verse }}</sup>{{ verse.text }}{{ " " }}
                </template>
              </div>
            </article>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              class="training-chip btn btn-sm rounded-full"
              :class="dayInfo?.status === 'done' ? 'btn-ghost' : 'btn-primary'"
              :disabled="busy"
              @click="markDay(dayInfo?.status === 'done' ? 'clear' : 'done')"
            >
              {{ dayInfo?.status === "done" ? "Mark unread" : "Mark read" }}
            </button>
            <button
              v-if="dayInfo?.status !== 'done'"
              type="button"
              class="training-chip btn btn-ghost btn-sm rounded-full"
              :disabled="busy"
              @click="markDay(dayInfo?.status === 'skipped' ? 'clear' : 'skipped')"
            >
              {{ dayInfo?.status === "skipped" ? "Unskip" : "Skip this day" }}
            </button>
          </div>
          <p v-if="actionError" class="mt-2 text-sm text-red-600">{{ actionError }}</p>
        </section>

        <details class="app-card min-w-0 px-4 py-4">
          <summary class="cursor-pointer text-sm font-semibold text-gray-900">All days</summary>
          <ol class="mt-3 divide-y divide-gray-200">
            <li v-for="item in detail.days" :key="item.day">
              <button
                type="button"
                class="plan-day-row"
                :class="{ 'is-current': item.day === currentDay }"
                @click="openDay(item.day)"
              >
                <span class="plan-day-row__mark" :class="item.status ? `is-${item.status}` : ''" aria-hidden="true">
                  <AppIcon v-if="item.status === 'done'" name="checkmark" :size="16" filled />
                  <AppIcon v-else-if="item.status === 'skipped'" name="remove" :size="16" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-xs text-gray-700">Day {{ item.day }} · {{ formatDate(item.date) }}</span>
                  <span class="block truncate text-sm text-gray-900">{{ item.citation }}</span>
                </span>
              </button>
            </li>
          </ol>
        </details>

        <section class="flex flex-wrap gap-2">
          <button
            v-if="detail.plan.status === 'active'"
            type="button"
            class="training-chip btn btn-ghost btn-sm rounded-full"
            :disabled="busy"
            @click="planAction('stop')"
          >
            Stop this plan
          </button>
          <button
            v-if="detail.plan.status === 'stopped'"
            type="button"
            class="training-chip btn btn-primary btn-sm rounded-full"
            :disabled="busy"
            @click="planAction('resume')"
          >
            Pick up where I left off
          </button>
          <button
            type="button"
            class="training-chip btn btn-ghost btn-sm rounded-full"
            :disabled="busy"
            @click="confirmRestart"
          >
            Start over from day 1
          </button>
        </section>
      </template>
    </template>

    <!-- Plans list and library -->
    <template v-else>
      <section v-if="plans.length" class="space-y-3">
        <h2 class="text-sm font-semibold text-gray-900">Your plans</h2>
        <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <li v-for="plan in plans" :key="plan.user_plan_id">
            <button type="button" class="app-card-link plan-card w-full text-left" @click="openPlan(plan.user_plan_id)">
              <span class="sl-caption">{{ statusLabel(plan) }}</span>
              <h3 class="mt-1 text-ink">{{ plan.name }}</h3>
              <span class="plan-progress mt-2 block"><span :style="{ width: `${plan.progress.percent}%` }" /></span>
              <span class="mt-2 block text-sm text-muted">
                {{ plan.progress.done }} of {{ plan.length }} days read<span v-if="plan.status === 'active' && plan.progress.behind"> · {{ plan.progress.behind }} to catch up</span>
              </span>
              <span v-if="plan.status === 'active' && plan.focus_citation" class="sl-scripture mt-2 block">{{ plan.focus_citation }}</span>
            </button>
          </li>
        </ul>
      </section>

      <section class="space-y-3">
        <h2 class="text-sm font-semibold text-gray-900">Start a plan</h2>
        <p class="text-xs text-gray-700">Readings are shown in your translation ({{ faith.translationLabel.value }}).</p>
        <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <li v-for="plan in library" :key="plan.key" class="app-card flex min-w-0 flex-col px-4 py-4">
            <span class="sl-caption">{{ plan.length }} days<span v-if="plan.season"> · {{ plan.season === "advent" ? "Advent" : "Lent" }}</span></span>
            <h3 class="mt-1 text-base font-semibold text-gray-900">{{ plan.name }}</h3>
            <p class="mt-1 flex-1 text-sm leading-6 text-muted">{{ plan.description }}</p>
            <p class="mt-2 text-xs text-gray-700">Day 1: {{ plan.first_day }}</p>
            <template v-if="runningKeys.has(plan.key)">
              <button type="button" class="training-chip btn btn-ghost btn-sm mt-3 w-fit rounded-full" @click="openPlan(runningIdFor(plan.key))">
                Continue
              </button>
            </template>
            <form v-else class="mt-3 flex flex-wrap items-end gap-2" @submit.prevent="startPlan(plan)">
              <label class="form-control min-w-0">
                <span class="label py-1"><span class="label-text text-xs">Start on</span></span>
                <input v-model="startDates[plan.key]" type="date" class="input input-bordered input-sm w-full min-w-0" />
              </label>
              <button type="submit" class="training-chip btn btn-primary btn-sm rounded-full" :disabled="startingKey === plan.key">
                {{ startingKey === plan.key ? "Starting…" : "Start" }}
              </button>
            </form>
          </li>
        </ul>
        <p v-if="actionError" class="text-sm text-red-600">{{ actionError }}</p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { parseFetchError } from "~/utils/parseFetchError";
import { todayIsoDate } from "~/utils/liturgicalCalendar";

const faith = useFaithProfile();
const { light } = useHaptics();
const route = useRoute();
const router = useRouter();

const library = ref([]);
const plans = ref([]);
const loading = ref(true);
const loadError = ref("");
const unavailableMessage = ref("");
const startDates = reactive({});
const startingKey = ref("");
const actionError = ref("");
const busy = ref(false);

const detail = ref(null);
const detailError = ref("");
const currentDay = ref(0);
const readings = ref([]);
const textLoading = ref(false);
const textError = ref("");
const catalogMessage = ref("");
const catalogNotice = ref("");

const selectedId = computed(() => Number(route.query.plan) || 0);
const runningKeys = computed(() => new Set(plans.value.filter((plan) => plan.status === "active").map((plan) => plan.plan_key)));
const dayInfo = computed(() => detail.value?.days?.[currentDay.value - 1] || null);

function spansChapters(reading) {
  const verses = reading?.verses || [];
  return verses.length > 0 && reading.book !== "Psalms" && verses[0].chapter !== verses[verses.length - 1].chapter;
}

function runningIdFor(key) {
  return plans.value.find((plan) => plan.plan_key === key && plan.status === "active")?.user_plan_id || 0;
}

function formatDate(iso, long = false) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(
    "en-US",
    long ? { weekday: "long", month: "long", day: "numeric" } : { month: "short", day: "numeric", year: y === new Date().getFullYear() ? undefined : "numeric" },
  );
}

function statusLabel(plan) {
  if (plan.status === "completed") return "Finished";
  if (plan.status === "stopped") return "Stopped";
  if (plan.progress.notStarted) return `Starts ${formatDate(plan.start_on)}`;
  if (plan.progress.todayDone) return "Today is read";
  return `Day ${plan.progress.scheduledDay} of ${plan.length}`;
}

async function loadList() {
  loading.value = true;
  loadError.value = "";
  try {
    const data = await $fetch("/api/spiritual/plans", { query: { date: todayIsoDate() } });
    unavailableMessage.value = data?.unavailable ? data.message : "";
    library.value = data?.library || [];
    plans.value = data?.plans || [];
    for (const plan of library.value) {
      if (!startDates[plan.key]) startDates[plan.key] = plan.suggested_start;
    }
  } catch (error) {
    loadError.value = parseFetchError(error, "Failed to load reading plans.");
  } finally {
    loading.value = false;
  }
}

async function loadDetail(id, preferredDay) {
  detailError.value = "";
  try {
    const data = await $fetch(`/api/spiritual/plans/${id}`, { query: { date: todayIsoDate() } });
    detail.value = data;
    const fallback = data.plan.focus_day || data.plan.progress.scheduledDay || 1;
    const day = Number(preferredDay) || currentDay.value || fallback;
    await openDay(Math.min(Math.max(1, day), data.plan.length), { replace: true });
  } catch (error) {
    detail.value = null;
    detailError.value = parseFetchError(error, "Failed to load the plan.");
  }
}

async function loadText() {
  if (!detail.value || !currentDay.value) return;
  const id = detail.value.plan.user_plan_id;
  const day = currentDay.value;
  textLoading.value = true;
  textError.value = "";
  try {
    const data = await $fetch(`/api/spiritual/plans/${id}/day`, { query: { day } });
    if (currentDay.value !== day) return;
    readings.value = data?.readings || [];
    catalogMessage.value = data?.catalog?.message || "";
    catalogNotice.value = data?.catalog?.notice || "";
  } catch (error) {
    textError.value = parseFetchError(error, "Failed to load the reading.");
  } finally {
    textLoading.value = false;
  }
}

async function openDay(day, { replace = false } = {}) {
  if (!detail.value) return;
  const changed = day !== currentDay.value;
  currentDay.value = day;
  const query = { ...route.query, plan: String(detail.value.plan.user_plan_id), day: String(day) };
  if (String(route.query.day || "") !== String(day)) {
    await (replace ? router.replace({ query }) : router.push({ query }));
  }
  if (changed || !readings.value.length) await loadText();
}

function openPlan(id) {
  if (!id) return;
  detail.value = null;
  currentDay.value = 0;
  readings.value = [];
  void router.push({ query: { plan: String(id) } });
}

function closePlan() {
  void router.push({ query: {} });
}

async function startPlan(plan) {
  startingKey.value = plan.key;
  actionError.value = "";
  try {
    const data = await $fetch("/api/spiritual/plans", {
      method: "POST",
      body: { plan_key: plan.key, start_on: startDates[plan.key], date: todayIsoDate() },
    });
    await loadList();
    openPlan(data.plan.user_plan_id);
  } catch (error) {
    actionError.value = parseFetchError(error, "Could not start the plan.");
  } finally {
    startingKey.value = "";
  }
}

async function markDay(status) {
  if (!detail.value || !currentDay.value) return;
  busy.value = true;
  actionError.value = "";
  try {
    const wasDay = currentDay.value;
    detail.value = await $fetch(`/api/spiritual/plans/${detail.value.plan.user_plan_id}/days/${wasDay}`, {
      method: "PUT",
      body: { status, date: todayIsoDate() },
    });
    void loadList();
    if (status === "done") light();
    // After reading, move on to the next unread day when it is due.
    const next = detail.value.plan.progress.nextDay;
    const scheduled = detail.value.plan.progress.scheduledDay;
    if (status === "done" && next && next !== wasDay && next <= Math.max(scheduled, 1)) await openDay(next);
  } catch (error) {
    actionError.value = parseFetchError(error, "Could not save that day.");
  } finally {
    busy.value = false;
  }
}

async function planAction(action) {
  if (!detail.value) return;
  busy.value = true;
  actionError.value = "";
  try {
    detail.value = await $fetch(`/api/spiritual/plans/${detail.value.plan.user_plan_id}`, {
      method: "PUT",
      body: { action, date: todayIsoDate() },
    });
    void loadList();
    if (action !== "stop") {
      const day = detail.value.plan.focus_day || 1;
      await openDay(day);
    }
  } catch (error) {
    actionError.value = parseFetchError(error, "Could not update the plan.");
  } finally {
    busy.value = false;
  }
}

function confirmRestart() {
  if (window.confirm("Start this plan again from day 1 today? Your marks for this plan will be cleared.")) {
    void planAction("restart");
  }
}

watch(
  selectedId,
  (id) => {
    if (id) {
      if (!detail.value || detail.value.plan.user_plan_id !== id) void loadDetail(id, route.query.day);
    } else {
      detail.value = null;
      currentDay.value = 0;
      readings.value = [];
    }
  },
  { immediate: true },
);

watch(
  () => route.query.day,
  (day) => {
    const value = Number(day) || 0;
    if (detail.value && value && value !== currentDay.value) void openDay(value, { replace: true });
  },
);

onMounted(() => {
  void faith.load();
  void loadList();
});
</script>

<style scoped>
.plan-progress {
  height: 0.375rem;
  border-radius: 9999px;
  background: var(--sl-violet-tint, rgba(124, 58, 237, 0.12));
  overflow: hidden;
}
.plan-progress > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--sl-violet, #6d28d9);
}
.plan-text {
  font-family: "Fraunces Variable", ui-serif, Georgia, serif;
  color: var(--sl-ink, inherit);
  font-size: 1.05rem;
  line-height: 1.75;
  overflow-wrap: anywhere;
}
.plan-text__chapter {
  display: block;
  margin-top: 0.75rem;
  font-weight: 600;
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  opacity: 0.7;
}
.plan-text__chapter:first-child {
  margin-top: 0;
}
.plan-text__verse {
  margin-right: 0.15em;
  font-size: 0.65em;
  opacity: 0.6;
}
.plan-day-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.25rem;
  text-align: left;
  min-height: 44px;
}
.plan-day-row.is-current {
  background: var(--sl-violet-tint, rgba(124, 58, 237, 0.08));
  border-radius: 0.375rem;
}
.plan-day-row__mark {
  display: inline-flex;
  width: 1.5rem;
  height: 1.5rem;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid currentColor;
  font-size: 0.8rem;
  opacity: 0.45;
}
.plan-day-row__mark.is-done {
  opacity: 1;
  color: var(--sl-evergreen, #166534);
}
.plan-day-row__mark.is-skipped {
  opacity: 0.7;
}
.plan-card {
  display: flex;
  flex-direction: column;
}
</style>
