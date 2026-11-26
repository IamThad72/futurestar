<template>
  <div class="min-w-0 max-w-full space-y-6">
    <div
      v-if="unavailableMessage"
      class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      {{ unavailableMessage }}
    </div>
    <p v-else-if="loadError" class="text-sm text-red-600">{{ loadError }}</p>
    <div v-else-if="loading && !weekStart" class="app-card px-4 py-6 text-sm text-gray-700">Loading…</div>

    <template v-else>
      <section class="app-card min-w-0 max-w-full overflow-hidden px-4 py-4">
        <p class="sl-caption">{{ editingWeek === weekStart ? "This week" : "Week of" }} · {{ weekRange(editingWeek) }}</p>
        <h2 class="mt-1 text-base font-semibold text-gray-900">{{ terms.question }}</h2>
        <form class="mt-3 grid min-w-0 gap-3" @submit.prevent="save">
          <div class="flex flex-wrap gap-2" role="radiogroup" :aria-label="terms.question">
            <button
              v-for="option in attendanceOptions"
              :key="option.value"
              type="button"
              role="radio"
              class="training-chip btn btn-sm rounded-full"
              :class="form.attendance === option.value ? 'btn-primary' : 'btn-ghost'"
              :aria-checked="form.attendance === option.value"
              @click="form.attendance = option.value"
            >
              {{ option.label }}
            </button>
          </div>
          <template v-if="form.attendance && form.attendance !== 'not_this_week'">
            <label class="form-control min-w-0">
              <span class="label py-1"><span class="label-text text-sm">{{ terms.church }}</span></span>
              <input v-model="form.church_name" type="text" maxlength="120" class="worship-field input input-bordered" />
            </label>
            <label class="form-control min-w-0">
              <span class="label py-1"><span class="label-text text-sm">{{ terms.sermon }} (optional)</span></span>
              <input v-model="form.sermon_passage" type="text" maxlength="120" class="worship-field input input-bordered" placeholder="For example: John 6:35-51" />
            </label>
            <label class="form-control min-w-0">
              <span class="label py-1"><span class="label-text text-sm">{{ terms.notes }} (optional)</span></span>
              <textarea v-model="form.notes" rows="3" maxlength="4000" class="worship-field textarea textarea-bordered" />
            </label>
          </template>
          <label v-if="form.attendance" class="form-control min-w-0">
            <span class="label h-auto min-h-0 items-start py-1">
              <span class="label-text text-sm whitespace-normal break-words">One thing to carry into the week (optional)</span>
            </span>
            <input v-model="form.takeaway" type="text" maxlength="500" class="worship-field input input-bordered" />
          </label>
          <p v-if="saveError" class="text-sm text-red-600">{{ saveError }}</p>
          <p v-else-if="saveNotice" class="text-sm text-emerald-700 dark:text-emerald-400">{{ saveNotice }}</p>
          <div class="flex flex-wrap gap-2">
            <button type="submit" class="training-chip btn btn-primary btn-sm w-fit rounded-full" :disabled="saving || !form.attendance">
              {{ saving ? "Saving…" : "Save" }}
            </button>
            <button v-if="editingWeek !== weekStart" type="button" class="training-chip btn btn-ghost btn-sm rounded-full" @click="editWeek(weekStart)">
              Back to this week
            </button>
            <button v-if="entryFor(editingWeek)" type="button" class="training-chip btn btn-ghost btn-sm rounded-full" :disabled="saving" @click="clearWeek">
              Clear
            </button>
          </div>
        </form>
      </section>

      <section class="app-card min-w-0 px-4 py-4">
        <h2 class="text-sm font-semibold text-gray-900">Recent weeks</h2>
        <p class="sl-scripture mt-2 inline-flex items-start gap-1.5">
          <AppIcon name="flame" :size="18" class="mt-0.5 shrink-0" />
          <span>{{ streakText }}</span>
        </p>
        <ol class="mt-3 divide-y divide-gray-200">
          <li v-for="week in recentWeeks" :key="week">
            <button type="button" class="worship-row" :class="{ 'is-current': week === editingWeek }" @click="editWeek(week)">
              <span class="worship-row__mark" :class="markClass(entryFor(week))" aria-hidden="true">
                <AppIcon
                  v-if="attended(entryFor(week)?.attendance)"
                  name="checkmark-circle"
                  :size="18"
                  filled
                />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-xs text-gray-700">{{ weekRange(week) }}</span>
                <span class="block truncate text-sm text-gray-900">{{ rowText(entryFor(week)) }}</span>
                <span v-if="entryFor(week)?.takeaway" class="block truncate text-sm text-muted">“{{ entryFor(week).takeaway }}”</span>
              </span>
            </button>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>

<script setup>
import { parseFetchError } from "~/utils/parseFetchError";
import { todayIsoDate } from "~/utils/liturgicalCalendar";
import { addDays } from "~/utils/readingPlans";
import { attendanceLabel, attended, streakMessage, worshipTerms } from "~/utils/worshipCheckin";

const faith = useFaithProfile();
const loading = ref(true);
const loadError = ref("");
const unavailableMessage = ref("");
const tradition = ref("");
const weekStart = ref("");
const history = ref([]);
const streak = ref(0);
const lastChurch = ref("");
const editingWeek = ref("");
const form = ref(emptyForm());
const saving = ref(false);
const saveError = ref("");
const saveNotice = ref("");

const activeTradition = computed(() => tradition.value || (faith.loaded.value ? faith.tradition.value : ""));
const terms = computed(() => worshipTerms(activeTradition.value));
const attendanceOptions = computed(() => [
  { value: "in_person", label: terms.value.inPerson },
  { value: "online", label: terms.value.online },
  { value: "not_this_week", label: terms.value.notThisWeek },
]);
const streakText = computed(() => streakMessage(streak.value, activeTradition.value));
const recentWeeks = computed(() =>
  weekStart.value ? Array.from({ length: 12 }, (_, index) => addDays(weekStart.value, -7 * index)) : [],
);

function emptyForm() {
  return { attendance: "", church_name: "", sermon_passage: "", notes: "", takeaway: "" };
}

function entryFor(week) {
  return history.value.find((row) => row.week_start === week) || null;
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function weekRange(week) {
  if (!week) return "";
  return `${formatDate(week)} – ${formatDate(addDays(week, 6))}`;
}

function rowText(entry) {
  if (!entry) return "No check-in";
  const label = attendanceLabel(entry.attendance, activeTradition.value);
  return entry.church_name && attended(entry.attendance) ? `${label} · ${entry.church_name}` : label;
}

function markClass(entry) {
  if (!entry) return "";
  return attended(entry.attendance) ? "is-attended" : "is-rest";
}

function editWeek(week) {
  editingWeek.value = week;
  saveError.value = "";
  saveNotice.value = "";
  const entry = entryFor(week);
  form.value = entry
    ? {
        attendance: entry.attendance,
        church_name: entry.church_name,
        sermon_passage: entry.sermon_passage,
        notes: entry.notes,
        takeaway: entry.takeaway,
      }
    : { ...emptyForm(), church_name: lastChurch.value };
}

function apply(data) {
  unavailableMessage.value = data?.unavailable ? data.message : "";
  tradition.value = data?.tradition || "";
  weekStart.value = data?.week_start || "";
  history.value = data?.history || [];
  streak.value = Number(data?.streak || 0);
  lastChurch.value = data?.last_church || "";
}

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    apply(await $fetch("/api/spiritual/worship", { query: { date: todayIsoDate() } }));
    editWeek(editingWeek.value || weekStart.value);
  } catch (error) {
    loadError.value = parseFetchError(error, "Failed to load worship check-ins.");
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  saveError.value = "";
  saveNotice.value = "";
  try {
    const body = { ...form.value, week_start: editingWeek.value, date: todayIsoDate() };
    if (body.attendance === "not_this_week") {
      body.church_name = "";
      body.sermon_passage = "";
      body.notes = "";
    }
    apply(await $fetch("/api/spiritual/worship", { method: "PUT", body }));
    editWeek(editingWeek.value);
    saveNotice.value = "Saved.";
  } catch (error) {
    saveError.value = parseFetchError(error, "Could not save the check-in.");
  } finally {
    saving.value = false;
  }
}

async function clearWeek() {
  saving.value = true;
  saveError.value = "";
  try {
    apply(await $fetch("/api/spiritual/worship", {
      method: "PUT",
      body: { week_start: editingWeek.value, clear: true, date: todayIsoDate() },
    }));
    editWeek(editingWeek.value);
    saveNotice.value = "Cleared.";
  } catch (error) {
    saveError.value = parseFetchError(error, "Could not clear the check-in.");
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void faith.load();
  void load();
});
</script>

<style scoped>
.worship-field {
  min-width: 0;
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
}
.worship-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.25rem;
  min-height: 44px;
  text-align: left;
}
.worship-row.is-current {
  background: var(--sl-violet-tint);
  border-radius: 0.375rem;
}
.worship-row__mark {
  width: 0.75rem;
  height: 0.75rem;
  flex: none;
  border-radius: 9999px;
  border: 1px solid var(--sl-muted, #888);
}
.worship-row__mark.is-attended {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--sl-violet);
}
.worship-row__mark.is-rest {
  background: var(--sl-violet-tint);
}
</style>
