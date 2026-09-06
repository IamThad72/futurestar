<template>
  <div class="space-y-6">
    <details class="physical-learn-more group">
      <summary class="training-chip btn btn-primary btn-sm rounded-full w-fit cursor-pointer">
        Learn more
      </summary>
      <div class="mt-5 space-y-5">
        <section v-for="item in learnMore" :key="item.name">
          <h2 class="!text-xs font-semibold text-gray-900">{{ item.name }}</h2>
          <p class="mt-1 text-xs leading-5 text-gray-600">{{ item.text }}</p>
        </section>
      </div>
    </details>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <aside class="space-y-3 lg:self-start">
        <div class="app-card px-4 py-4">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">History</h2>
            <button type="button" class="training-chip btn btn-ghost btn-xs rounded-full" @click="onNew">New</button>
          </div>
          <p v-if="listError" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ listError }}</p>
          <p v-else-if="listLoading && !sessions.length" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Loading sessions…
          </p>
          <p v-else-if="!sessions.length" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            No journal entries yet.
          </p>
          <div v-else class="mt-3 space-y-4">
            <section v-for="group in groupedHistory" :key="group.key">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ group.label }}
              </h3>
              <ul class="mt-2 space-y-1">
                <li v-for="item in group.sessions" :key="item.sessionId">
                  <button
                    type="button"
                    class="flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm no-underline hover:bg-gray-100 dark:hover:bg-white/10"
                    :class="
                      draft.sessionId === item.sessionId
                        ? 'bg-primary/10'
                        : ''
                    "
                    @click="openSession(item.sessionId)"
                  >
                    <span class="min-w-0">
                      <span class="block truncate font-medium text-gray-900 dark:text-white">
                        {{ sessionTitle(item) }}
                      </span>
                      <span class="block text-xs text-gray-500 dark:text-gray-400">
                        {{ formatWhen(item.performedAt) }} · {{ item.exerciseCount }} exercises
                      </span>
                    </span>
                  </button>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </aside>

      <div class="space-y-4">
        <section
          v-if="!draft.sessionId"
          class="app-card px-4 py-4"
        >
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Start a session</h2>
            <button
              type="button"
              class="training-chip btn btn-primary btn-sm shrink-0 rounded-full"
              :disabled="!canStartSession"
              @click="startSession"
            >
              {{ saving ? "Starting…" : "Start Session" }}
            </button>
          </div>
          <p v-if="saveError" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ saveError }}</p>
          <div class="mt-4 grid gap-3">
            <label class="form-control w-full max-w-lg">
              <span class="label py-1"><span class="label-text text-sm">Session name</span></span>
              <input
                v-model.trim="startForm.name"
                type="text"
                maxlength="120"
                class="input input-bordered w-full"
                placeholder="e.g. Evening lift"
              />
            </label>
            <label class="form-control w-full max-w-sm">
              <span class="label py-1"><span class="label-text text-sm">When</span></span>
              <input v-model="startForm.performedAt" type="datetime-local" class="input input-bordered w-full" />
            </label>
            <label class="form-control w-full max-w-lg">
              <span class="label py-1"><span class="label-text text-sm">Workout</span></span>
              <select v-model="startForm.workoutId" class="select select-bordered w-full">
                <option value="">Custom / random exercises</option>
                <option v-for="workout in savedWorkouts" :key="workout.workoutId" :value="String(workout.workoutId)">
                  {{ workout.name }} ({{ workout.exerciseCount }})
                </option>
              </select>
            </label>
            <p v-if="workoutsError" class="text-sm text-amber-700 dark:text-amber-400">{{ workoutsError }}</p>
            <p v-if="workoutLoading" class="text-sm text-gray-500 dark:text-gray-400">Loading workout exercises…</p>
          </div>
        </section>

        <section
          v-else
          class="space-y-4"
        >
          <div class="app-card px-4 py-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ sessionTitle(draft) }}</h2>
                <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {{ draft.workoutName ? `From plan: ${draft.workoutName}` : "Custom / random exercises" }}
                  <span v-if="saveNotice" class="ml-2 text-emerald-700 dark:text-emerald-400">{{ saveNotice }}</span>
                  <span v-else-if="saving" class="ml-2">Saving…</span>
                </p>
              </div>
              <button
                type="button"
                class="training-chip btn btn-ghost btn-sm rounded-full text-red-600 dark:text-red-400"
                :disabled="saving"
                @click="deleteSession"
              >
                Delete
              </button>
            </div>
            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <label class="form-control">
                <span class="label py-1"><span class="label-text text-sm">When</span></span>
                <input
                  :value="toDatetimeLocalValue(draft.performedAt)"
                  type="datetime-local"
                  class="input input-bordered w-full"
                  @input="draft.performedAt = fromDatetimeLocalValue($event.target.value); markDirty()"
                />
              </label>
              <label class="form-control">
                <span class="label py-1"><span class="label-text text-sm">Session name</span></span>
                <input
                  v-model.trim="draft.name"
                  type="text"
                  maxlength="120"
                  class="input input-bordered w-full"
                  @input="markDirty"
                />
              </label>
            </div>
            <label class="form-control mt-3">
              <span class="label py-1"><span class="label-text text-sm">Notes</span></span>
              <textarea
                v-model="draft.notes"
                rows="2"
                class="textarea textarea-bordered w-full"
                @input="markDirty"
              />
            </label>
            <p v-if="saveError" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ saveError }}</p>
          </div>
        </section>

          <div
            v-for="item in draft.exercises"
            :key="item.key"
            class="app-card px-4 py-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ item.exerciseName }}</h3>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ item.logMode === "duration" ? "Time-based" : "Strength / reps" }}
                </p>
              </div>
              <button
                type="button"
                class="training-chip btn btn-ghost btn-xs rounded-full text-red-600 dark:text-red-400"
                @click="removeExercise(item.key)"
              >
                Remove
              </button>
            </div>

            <div class="mt-3 overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th class="w-10">Set</th>
                    <th v-if="item.logMode === 'reps'">Reps</th>
                    <th>Weight</th>
                    <th class="w-20">Unit</th>
                    <template v-if="item.logMode === 'duration'">
                      <th>Min</th>
                      <th>Sec</th>
                    </template>
                    <th class="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(set, setIndex) in item.sets" :key="set.key">
                    <td class="tabular-nums text-gray-500">{{ setIndex + 1 }}</td>
                    <td v-if="item.logMode === 'reps'">
                      <input
                        :value="set.reps ?? ''"
                        type="number"
                        min="0"
                        max="999"
                        class="input input-bordered input-sm w-20"
                        @input="updateSet(item, set, 'reps', $event.target.value)"
                      />
                    </td>
                    <td>
                      <input
                        :value="set.weight ?? ''"
                        type="number"
                        min="0"
                        max="9999"
                        step="0.5"
                        class="input input-bordered input-sm w-24"
                        @input="updateSet(item, set, 'weight', $event.target.value)"
                      />
                    </td>
                    <td>
                      <select
                        :value="set.weightUnit"
                        class="select select-bordered select-sm w-full"
                        @change="updateSet(item, set, 'weightUnit', $event.target.value)"
                      >
                        <option value="lb">lb</option>
                        <option value="kg">kg</option>
                      </select>
                    </td>
                    <template v-if="item.logMode === 'duration'">
                      <td>
                        <input
                          :value="durationMinutes(set)"
                          type="number"
                          min="0"
                          max="1440"
                          class="input input-bordered input-sm w-20"
                          @input="setDurationPart(item, set, 'min', $event.target.value)"
                        />
                      </td>
                      <td>
                        <input
                          :value="durationSecondsPart(set)"
                          type="number"
                          min="0"
                          max="59"
                          class="input input-bordered input-sm w-20"
                          @input="setDurationPart(item, set, 'sec', $event.target.value)"
                        />
                      </td>
                    </template>
                    <td>
                      <button
                        type="button"
                        class="training-chip btn btn-ghost btn-xs rounded-full"
                        :disabled="item.sets.length <= 1"
                        @click="removeSet(item, set.key)"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button type="button" class="training-chip btn btn-ghost btn-sm mt-2 rounded-full" @click="addSet(item)">
              Add set
            </button>
          </div>

          <p v-if="!draft.exercises.length" class="text-sm text-gray-500 dark:text-gray-400">
            {{
              draft.sessionId
                ? "No exercises yet. Add one from the catalog below."
                : "No exercises yet. Add one from the catalog below, then start the session."
            }}
          </p>

          <div class="app-card px-4 py-4">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Add exercise</h2>
            <div class="mt-3 flex flex-col gap-5">
              <div class="flex flex-wrap gap-1.5">
                <div
                  v-for="tab in pickerTabs"
                  :key="tab.key"
                  role="button"
                  tabindex="0"
                  class="badge cursor-pointer rounded-full"
                  :class="
                    pickerTab === tab.key
                      ? 'badge-accent border-transparent'
                      : 'badge-ghost border border-base-content/60'
                  "
                  @click="pickerTab = tab.key"
                  @keydown.enter.prevent="pickerTab = tab.key"
                  @keydown.space.prevent="pickerTab = tab.key"
                >
                  {{ tab.label }}
                </div>
              </div>
              <input
                v-model.trim="pickerInput"
                type="search"
                class="input input-bordered w-full max-w-md rounded-full"
                placeholder="Search exercises"
                autocomplete="off"
              />
            </div>
            <p v-if="pickerError" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ pickerError }}</p>
            <p v-else-if="pickerLoading" class="mt-2 text-sm text-gray-500 dark:text-gray-400">Searching…</p>
            <ul v-else-if="pickerResults.length" class="mt-3 max-h-64 space-y-1 overflow-y-auto">
              <li v-for="exercise in pickerResults" :key="exercise.exerciseId || exercise.id">
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm no-underline hover:bg-gray-100 dark:hover:bg-white/10"
                  :disabled="!catalogExerciseId(exercise)"
                  @click="addCatalogExercise(exercise)"
                >
                  <span class="min-w-0">
                    <span class="block font-medium text-gray-900 dark:text-white">{{ exercise.name }}</span>
                    <span class="block text-xs text-gray-500 dark:text-gray-400">
                      {{ exercise.equipment || "catalog" }}
                      <span v-if="exercise.sets"> · {{ exercise.sets }} × {{ exercise.repetitions }}</span>
                    </span>
                  </span>
                  <PlusSmallIcon class="size-6 shrink-0 text-primary" aria-hidden="true" />
                </button>
              </li>
            </ul>
            <p
              v-else-if="pickerQuery && !pickerLoading"
              class="mt-2 text-sm text-gray-500 dark:text-gray-400"
            >
              No catalog matches. Try another name or tab.
            </p>
          </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { PlusSmallIcon } from "@heroicons/vue/20/solid";
import { parseFetchError } from "~/utils/parseFetchError";
import {
  catalogExerciseId,
  isTimeBasedExercise,
  payloadFromExercise,
} from "~/utils/workoutDraft";

const learnMore = [
  {
    name: "Start a session",
    text: "Log what you actually did. Name the session, pick a time, and optionally load a saved workout. Add at least one catalog exercise, then start. Plans in Workout Manager stay unchanged.",
  },
  {
    name: "Add exercises",
    text: "Search the same catalogs used on the Physical pages. Adding here only logs this session; it does not change a saved workout plan.",
  },
  {
    name: "History",
    text: "Past sessions stay on this journal. Open one to review or edit it, or choose New to start another.",
  },
];

function emptyDraft() {
  return {
    sessionId: null,
    workoutId: null,
    workoutName: null,
    name: "",
    notes: "",
    performedAt: new Date().toISOString(),
    exercises: [],
  };
}

function toDatetimeLocalValue(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const sessions = ref([]);
const listLoading = ref(false);
const listError = ref("");
const savedWorkouts = ref([]);
const workoutsError = ref("");
const workoutLoading = ref(false);
const saving = ref(false);
const saveError = ref("");
const saveNotice = ref("");
const dirty = ref(false);
const starting = ref(false);
const draft = ref(emptyDraft());

const startForm = ref({
  performedAt: toDatetimeLocalValue(new Date().toISOString()),
  workoutId: "",
  name: "",
});

const pickerTab = ref("strength");
const pickerInput = ref("");
const pickerQuery = ref("");
const pickerLoading = ref(false);
const pickerError = ref("");
const pickerResults = ref([]);

const pickerTabs = [
  { key: "strength", label: "Strength", path: "/api/physical/exercises", query: {} },
  { key: "cardio", label: "Cardio", path: "/api/physical/endurance", query: { kind: "cardio" } },
  { key: "aerobic", label: "Aerobic", path: "/api/physical/endurance", query: { kind: "aerobic" } },
  { key: "stretch", label: "Stretch", path: "/api/physical/flexibility", query: { kind: "stretch" } },
  { key: "yoga", label: "Yoga", path: "/api/physical/flexibility", query: { kind: "yoga" } },
  { key: "plyo", label: "Plyo", path: "/api/physical/flexibility", query: { kind: "plyo" } },
];

let lineSeq = 0;
let saveTimer;
let pickerTimer;
let applyingServer = false;

function nextKey(prefix) {
  lineSeq += 1;
  return `${prefix}-${Date.now()}-${lineSeq}`;
}

function emptySet(from) {
  return {
    key: nextKey("set"),
    journalSetId: from?.journalSetId ?? null,
    reps: from?.reps ?? null,
    weight: from?.weight ?? null,
    weightUnit: from?.weightUnit || "lb",
    durationSeconds: from?.durationSeconds ?? null,
    restSeconds: from?.restSeconds ?? null,
    notes: from?.notes ?? "",
  };
}

function fromDatetimeLocalValue(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function sessionTitle(item) {
  return item.name || item.workoutName || "Custom exercises";
}

function formatWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function localDateKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const canStartSession = computed(
  () => !saving.value && !workoutLoading.value && draft.value.exercises.length > 0,
);

const groupedHistory = computed(() => {
  const today = localDateKey(new Date().toISOString());
  const todaySessions = [];
  const earlier = [];
  for (const item of sessions.value) {
    if (localDateKey(item.performedAt) === today) todaySessions.push(item);
    else earlier.push(item);
  }
  const groups = [];
  if (todaySessions.length) groups.push({ key: "today", label: "Today", sessions: todaySessions });
  if (earlier.length) groups.push({ key: "earlier", label: "Earlier", sessions: earlier });
  return groups;
});

function applySession(session) {
  applyingServer = true;
  draft.value = {
    sessionId: session.sessionId,
    workoutId: session.workoutId,
    workoutName: session.workoutName,
    name: session.name || "",
    notes: session.notes || "",
    performedAt: session.performedAt,
    exercises: (session.exercises || []).map((item) => ({
      key: nextKey("ex"),
      journalExerciseId: item.journalExerciseId,
      exerciseId: item.exerciseId,
      exerciseName: item.exerciseName,
      equipmentKey: item.equipmentKey,
      gifUrl: item.gifUrl,
      logMode: item.logMode === "duration" ? "duration" : "reps",
      notes: item.notes || "",
      sets: (item.sets || []).map((set) => emptySet(set)),
    })),
  };
  for (const item of draft.value.exercises) {
    if (!item.sets.length) item.sets.push(emptySet());
  }
  dirty.value = false;
  saveError.value = "";
  nextTick(() => {
    applyingServer = false;
  });
}

function mergeSavedIds(session) {
  if (!session) return;
  draft.value.sessionId = session.sessionId;
  draft.value.workoutId = session.workoutId;
  draft.value.workoutName = session.workoutName;
  const remoteExercises = session.exercises || [];
  draft.value.exercises.forEach((local, index) => {
    const remote = remoteExercises[index];
    if (!remote) return;
    local.journalExerciseId = remote.journalExerciseId;
    (remote.sets || []).forEach((set, setIndex) => {
      if (local.sets[setIndex]) local.sets[setIndex].journalSetId = set.journalSetId;
    });
  });
}

function payloadForSave() {
  return {
    performedAt: draft.value.performedAt,
    name: draft.value.name,
    notes: draft.value.notes,
    exercises: draft.value.exercises.map((item) => ({
      exerciseId: item.exerciseId,
      exerciseName: item.exerciseName,
      equipmentKey: item.equipmentKey,
      gifUrl: item.gifUrl,
      logMode: item.logMode,
      notes: item.notes,
      sets: item.sets.map((set) => ({
        reps: set.reps,
        weight: set.weight,
        weightUnit: set.weightUnit,
        durationSeconds: set.durationSeconds,
        restSeconds: set.restSeconds,
        notes: set.notes || null,
      })),
    })),
  };
}

function markDirty() {
  if (applyingServer) return;
  dirty.value = true;
  saveNotice.value = "";
  scheduleSave();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  if (!draft.value.sessionId) return;
  saveTimer = setTimeout(() => {
    void saveSession();
  }, 800);
}

async function loadHistory() {
  listLoading.value = true;
  listError.value = "";
  try {
    const data = await $fetch("/api/physical/journal");
    sessions.value = data.sessions || [];
  } catch (error) {
    listError.value = parseFetchError(error, "Could not load journal history.");
  } finally {
    listLoading.value = false;
  }
}

async function loadWorkouts() {
  workoutsError.value = "";
  try {
    const data = await $fetch("/api/physical/workouts");
    savedWorkouts.value = data.workouts || [];
  } catch (error) {
    workoutsError.value = parseFetchError(error, "Could not load saved workouts.");
  }
}

async function startSession() {
  saving.value = true;
  starting.value = true;
  saveError.value = "";
  try {
    const body = {
      performedAt: fromDatetimeLocalValue(startForm.value.performedAt),
      name: startForm.value.name || null,
      workoutId: startForm.value.workoutId ? Number(startForm.value.workoutId) : null,
      exercises: payloadForSave().exercises,
    };
    const data = await $fetch("/api/physical/journal", { method: "POST", body });
    applySession(data.session);
    saveNotice.value = "Started.";
    await loadHistory();
  } catch (error) {
    saveError.value = parseFetchError(error, "Could not start this session.");
  } finally {
    saving.value = false;
    starting.value = false;
  }
}

async function openSession(sessionId) {
  if (draft.value.sessionId === sessionId) return;
  if (dirty.value) await saveSession();
  saveError.value = "";
  try {
    const data = await $fetch(`/api/physical/journal/${sessionId}`);
    applySession(data.session);
    saveNotice.value = "";
  } catch (error) {
    saveError.value = parseFetchError(error, "Could not open that session.");
  }
}

async function saveSession() {
  if (!draft.value.sessionId) return false;
  saving.value = true;
  saveError.value = "";
  dirty.value = false;
  try {
    const data = await $fetch(`/api/physical/journal/${draft.value.sessionId}`, {
      method: "PUT",
      body: payloadForSave(),
    });
    if (!dirty.value) {
      mergeSavedIds(data.session);
      saveNotice.value = "Saved.";
      await loadHistory();
    } else {
      mergeSavedIds(data.session);
      scheduleSave();
    }
    return true;
  } catch (error) {
    dirty.value = true;
    saveError.value = parseFetchError(error, "Could not save this session.");
    return false;
  } finally {
    saving.value = false;
  }
}

async function deleteSession() {
  if (!draft.value.sessionId) return;
  if (!window.confirm("Delete this journal session? This cannot be undone.")) return;
  saving.value = true;
  saveError.value = "";
  try {
    await $fetch(`/api/physical/journal/${draft.value.sessionId}`, { method: "DELETE" });
    closeEditor();
    await loadHistory();
  } catch (error) {
    saveError.value = parseFetchError(error, "Could not delete this session.");
  } finally {
    saving.value = false;
  }
}

async function onNew() {
  if (draft.value.sessionId && dirty.value) await saveSession();
  closeEditor();
}

function closeEditor() {
  clearTimeout(saveTimer);
  draft.value = emptyDraft();
  dirty.value = false;
  saveError.value = "";
  saveNotice.value = "";
  startForm.value = {
    performedAt: toDatetimeLocalValue(new Date().toISOString()),
    workoutId: "",
    name: "",
  };
}

function updateSet(item, set, field, raw) {
  if (field === "weightUnit") {
    set.weightUnit = raw === "kg" ? "kg" : "lb";
  } else if (raw === "") {
    set[field] = null;
  } else {
    const n = Number(raw);
    set[field] = Number.isFinite(n) ? n : null;
  }
  markDirty();
}

function durationMinutes(set) {
  if (set.durationSeconds == null || set.durationSeconds === "") return "";
  return Math.floor(Number(set.durationSeconds) / 60);
}

function durationSecondsPart(set) {
  if (set.durationSeconds == null || set.durationSeconds === "") return "";
  return Number(set.durationSeconds) % 60;
}

function setDurationPart(item, set, part, raw) {
  const current = Number(set.durationSeconds) || 0;
  let minutes = Math.floor(current / 60);
  let seconds = current % 60;
  if (raw === "") {
    if (part === "min") minutes = 0;
    else seconds = 0;
    set.durationSeconds = minutes * 60 + seconds || null;
    markDirty();
    return;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return;
  if (part === "min") minutes = Math.min(Math.round(n), 1440);
  else seconds = Math.min(Math.round(n), 59);
  set.durationSeconds = minutes * 60 + seconds;
  markDirty();
}

function addSet(item) {
  const last = item.sets[item.sets.length - 1];
  item.sets.push(
    emptySet({
      reps: last?.reps ?? (item.logMode === "reps" ? 8 : null),
      weight: last?.weight ?? null,
      weightUnit: last?.weightUnit || "lb",
      durationSeconds: last?.durationSeconds ?? (item.logMode === "duration" ? 60 : null),
    }),
  );
  markDirty();
}

function removeSet(item, key) {
  if (item.sets.length <= 1) return;
  item.sets = item.sets.filter((set) => set.key !== key);
  markDirty();
}

function removeExercise(key) {
  draft.value.exercises = draft.value.exercises.filter((item) => item.key !== key);
  markDirty();
}

function journalItemFromWorkout(item) {
  const timeBased = item.durationSeconds != null;
  const setCount = Math.min(Math.max(item.sets || 1, 1), 8);
  const template = {
    reps: timeBased ? null : item.reps,
    weight: item.weight,
    weightUnit: item.weightUnit || "lb",
    durationSeconds: timeBased ? item.durationSeconds : null,
    restSeconds: item.restSeconds ?? null,
  };
  return {
    key: nextKey("ex"),
    journalExerciseId: null,
    exerciseId: item.exerciseId,
    exerciseName: item.name,
    equipmentKey: item.equipmentKey || null,
    gifUrl: item.gifUrl || null,
    logMode: timeBased ? "duration" : "reps",
    notes: item.notes || "",
    fromWorkout: true,
    sets: Array.from({ length: setCount }, () => emptySet(template)),
  };
}

async function loadWorkoutIntoDraft(workoutId) {
  if (!workoutId) return;
  workoutLoading.value = true;
  saveError.value = "";
  try {
    const data = await $fetch(`/api/physical/workouts/${workoutId}`);
    const workout = data.workout;
    const loaded = (workout.exercises || []).map((item) => journalItemFromWorkout(item));
    const loadedIds = new Set(loaded.map((item) => item.exerciseId).filter(Boolean));
    const extras = draft.value.exercises.filter(
      (item) => !item.fromWorkout && item.exerciseId && !loadedIds.has(item.exerciseId),
    );
    draft.value.exercises = [...loaded, ...extras];
    draft.value.workoutName = workout.name;
  } catch (error) {
    saveError.value = parseFetchError(error, "Could not load that workout.");
  } finally {
    workoutLoading.value = false;
  }
}

function addCatalogExercise(exercise) {
  const payload = payloadFromExercise(exercise);
  if (!payload.exerciseId) {
    saveError.value = "That exercise is not in the catalog yet.";
    return;
  }
  const timeBased = isTimeBasedExercise(exercise) || payload.durationSeconds != null;
  const setCount = Math.min(Math.max(payload.sets || 1, 1), 8);
  const template = {
    reps: timeBased ? null : payload.reps,
    weight: payload.weight,
    weightUnit: payload.weightUnit,
    durationSeconds: timeBased ? payload.durationSeconds : null,
  };
  draft.value.exercises.push({
    key: nextKey("ex"),
    journalExerciseId: null,
    exerciseId: payload.exerciseId,
    exerciseName: payload.name,
    equipmentKey: exercise.equipment || null,
    gifUrl: payload.gifUrl || null,
    logMode: timeBased ? "duration" : "reps",
    notes: "",
    fromWorkout: false,
    sets: Array.from({ length: setCount }, () => emptySet(template)),
  });
  markDirty();
}

async function loadPicker() {
  const tab = pickerTabs.find((item) => item.key === pickerTab.value) || pickerTabs[0];
  pickerLoading.value = true;
  pickerError.value = "";
  try {
    const data = await $fetch(tab.path, {
      query: {
        ...tab.query,
        q: pickerQuery.value || undefined,
        limit: 24,
      },
    });
    const featured = data.featured || [];
    const catalog = data.catalog?.items || [];
    const seen = new Set();
    pickerResults.value = [...featured, ...catalog].filter((exercise) => {
      const id = catalogExerciseId(exercise);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    }).slice(0, 16);
  } catch (error) {
    pickerResults.value = [];
    pickerError.value = parseFetchError(error, "Could not search exercises.");
  } finally {
    pickerLoading.value = false;
  }
}

watch(pickerInput, (value) => {
  clearTimeout(pickerTimer);
  pickerTimer = setTimeout(() => {
    pickerQuery.value = value;
  }, 300);
});

watch([pickerTab, pickerQuery], () => {
  void loadPicker();
});

watch(
  () => startForm.value.workoutId,
  (workoutId) => {
    if (draft.value.sessionId) return;
    void loadWorkoutIntoDraft(workoutId);
  },
);

onMounted(() => {
  void loadHistory();
  void loadWorkouts();
  void loadPicker();
});

onBeforeUnmount(() => {
  clearTimeout(saveTimer);
  clearTimeout(pickerTimer);
  if (draft.value.sessionId && dirty.value) void saveSession();
});
</script>

<style scoped>
.physical-learn-more > summary {
  list-style: none;
}

.physical-learn-more > summary::-webkit-details-marker {
  display: none;
}
</style>
