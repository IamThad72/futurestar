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
          <div v-else class="mt-3">
            <section v-for="group in groupedHistory" :key="group.key">
              <ion-list lines="full" class="journal-ion-list">
                <ion-list-header>{{ group.label }}</ion-list-header>
                <ion-item
                  v-for="item in group.sessions"
                  :key="item.sessionId"
                  button
                  :detail="false"
                  class="journal-history-item"
                  :class="{ 'journal-history-item--current': draft.sessionId === item.sessionId }"
                  @click="openSession(item.sessionId)"
                >
                  <ion-label>
                    <h2>{{ sessionTitle(item) }}</h2>
                    <p>
                      {{ formatWhen(item.performedAt) }} · {{ item.exerciseCount }}
                      {{ item.exerciseCount === 1 ? "exercise" : "exercises" }}
                    </p>
                  </ion-label>
                </ion-item>
              </ion-list>
            </section>
          </div>
        </div>
      </aside>

      <div class="min-w-0 space-y-4">
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
            v-for="(item, index) in draft.exercises"
            :key="item.key"
            class="app-card flex min-w-0 w-full max-w-full items-start gap-2 overflow-hidden py-3 pl-4 pr-1"
          >
            <div class="min-w-0 flex-1 overflow-hidden">
            <div class="min-w-0">
              <div class="flex min-w-0 items-center gap-2">
                <h3 class="journal-exercise-title min-w-0 flex-1 truncate">{{ item.exerciseName }}</h3>
                <button
                  type="button"
                  class="journal-add-set training-chip btn btn-primary btn-xs shrink-0 rounded-full"
                  @click="addSet(item)"
                >
                  Add set
                </button>
              </div>
            </div>

            <div class="mt-2 overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th class="w-10">Set</th>
                    <th v-if="item.logMode === 'reps'">Reps</th>
                    <th v-if="usesLoadedWeight(item)">Wgt</th>
                    <th v-if="item.logMode === 'duration'">Min</th>
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
                        inputmode="numeric"
                        class="input input-bordered input-sm compact-num-input"
                        aria-label="Reps"
                        @input="updateSet(item, set, 'reps', $event)"
                      />
                    </td>
                    <td v-if="usesLoadedWeight(item)">
                      <div class="journal-weight-field">
                        <input
                          :value="set.weight ?? ''"
                          type="number"
                          min="0"
                          max="999"
                          step="0.5"
                          inputmode="decimal"
                          class="input input-bordered input-sm compact-num-input"
                          aria-label="Weight in pounds"
                          @input="updateSet(item, set, 'weight', $event)"
                        />
                        <span class="journal-weight-unit">lbs</span>
                      </div>
                    </td>
                    <td v-if="item.logMode === 'duration'">
                      <input
                        :value="durationMinutes(set)"
                        type="number"
                        min="0"
                        max="1440"
                        step="0.01"
                        inputmode="decimal"
                        class="input input-bordered input-sm w-20"
                        aria-label="Minutes"
                        @input="setDurationMinutes(item, set, $event)"
                      />
                    </td>
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
            </div>
            <div class="flex shrink-0 flex-col gap-1">
              <button
                type="button"
                class="workout-line-ctrl"
                :disabled="index === 0"
                aria-label="Move up"
                @click="moveExercise(index, index - 1)"
              >
                ↑
              </button>
              <button
                type="button"
                class="workout-line-ctrl"
                :disabled="index === draft.exercises.length - 1"
                aria-label="Move down"
                @click="moveExercise(index, index + 1)"
              >
                ↓
              </button>
              <button
                type="button"
                class="workout-line-ctrl workout-line-ctrl--remove"
                aria-label="Remove exercise"
                @click="removeExercise(item.key)"
              >
                ×
              </button>
            </div>
          </div>

          <p v-if="!draft.exercises.length" class="text-sm text-gray-500 dark:text-gray-400">
            {{
              draft.sessionId
                ? "No exercises yet. Add one from the catalog below."
                : "No exercises yet. Add one from the catalog below, then start the session."
            }}
          </p>

          <div>
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Add exercise</h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Expand a list, then tap Add on each exercise you want in this session.
            </p>
            <div class="mt-3">
              <TrainingListsAccordion
                :add-exercise="addCatalogExercise"
                :added-exercises="draft.exercises"
              />
            </div>
          </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { IonItem, IonLabel, IonList, IonListHeader } from "@ionic/vue";
import { parseFetchError } from "~/utils/parseFetchError";
import {
  formatDurationMinutes,
  isTimeBasedExercise,
  limitMinuteInput,
  limitThreeDigitInput,
  minutesToDurationSeconds,
  payloadFromExercise,
  programmingDefaults,
  usesLoadedWeight,
  weightInLb,
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

let lineSeq = 0;
let saveTimer;
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
    weight: weightInLb(from?.weight, from?.weightUnit),
    weightUnit: "lb",
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
      usesWeight: usesLoadedWeight(item),
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
        weightUnit: "lb",
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

function updateSet(item, set, field, event) {
  const { text, value } = limitThreeDigitInput(event.target.value, { integer: field === "reps" });
  event.target.value = text;
  set[field] = value;
  set.weightUnit = "lb";
  markDirty();
}

function durationMinutes(set) {
  return formatDurationMinutes(set.durationSeconds);
}

function setDurationMinutes(item, set, event) {
  const { text, value } = limitMinuteInput(event.target.value);
  event.target.value = text;
  set.durationSeconds = minutesToDurationSeconds(value);
  markDirty();
}

function addSet(item) {
  const last = item.sets[item.sets.length - 1];
  item.sets.push(
    emptySet({
      reps: last?.reps ?? (item.logMode === "reps" ? 8 : null),
      weight: last?.weight ?? null,
      weightUnit: "lb",
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

function moveExercise(fromIndex, toIndex) {
  const items = draft.value.exercises;
  if (fromIndex < 0 || fromIndex >= items.length) return;
  if (toIndex < 0 || toIndex >= items.length) return;
  const [moved] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, moved);
  markDirty();
}

function journalItemFromWorkout(item) {
  const timeBased = isTimeBasedExercise(item);
  const setCount = Math.min(Math.max(item.sets || 1, 1), 8);
  const defaults = timeBased ? programmingDefaults(item) : null;
  const durationSeconds = timeBased
    ? (item.durationSeconds ?? defaults?.durationSeconds ?? 30)
    : null;
  const template = {
    reps: timeBased ? null : item.reps,
    weight: weightInLb(item.weight, item.weightUnit),
    weightUnit: "lb",
    durationSeconds,
    restSeconds: item.restSeconds ?? null,
  };
  return {
    key: nextKey("ex"),
    journalExerciseId: null,
    exerciseId: item.exerciseId,
    exerciseName: item.name,
    equipmentKey: item.equipmentKey || null,
    usesWeight: usesLoadedWeight(item),
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
  const timeBased = isTimeBasedExercise({ ...exercise, ...payload });
  const setCount = Math.min(Math.max(payload.sets || 1, 1), 8);
  const template = {
    reps: timeBased ? null : payload.reps,
    weight: payload.weight,
    weightUnit: "lb",
    durationSeconds: timeBased ? payload.durationSeconds : null,
  };
  draft.value.exercises.push({
    key: nextKey("ex"),
    journalExerciseId: null,
    exerciseId: payload.exerciseId,
    exerciseName: payload.name,
    equipmentKey: payload.equipmentKey || exercise.equipment || null,
    usesWeight: usesLoadedWeight({ ...exercise, ...payload }),
    gifUrl: payload.gifUrl || null,
    logMode: timeBased ? "duration" : "reps",
    notes: "",
    fromWorkout: false,
    sets: Array.from({ length: setCount }, () => emptySet(template)),
  });
  markDirty();
}

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
});

onBeforeUnmount(() => {
  clearTimeout(saveTimer);
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

.journal-ion-list {
  background: transparent;
  margin: 0;
  padding: 0;
}

.journal-ion-list ion-item {
  --background: transparent;
  --padding-start: 0;
  --inner-padding-end: 0;
}

.journal-ion-list ion-label h2 {
  font-size: 0.875rem;
  font-weight: 600;
}

.journal-ion-list ion-label p {
  font-size: 0.75rem;
  color: var(--color-gray-500, oklch(0.556 0 0));
}

.journal-history-item--current {
  --background: color-mix(in srgb, var(--color-primary, #06b6d4) 12%, transparent);
}

.compact-num-input {
  width: 3.25rem;
  min-width: 3.25rem;
  max-width: 3.25rem;
  padding-inline: 0.35rem;
  text-align: center;
  appearance: textfield;
  -moz-appearance: textfield;
}

.compact-num-input::-webkit-outer-spin-button,
.compact-num-input::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}

.journal-weight-field {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.journal-weight-unit {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-base-content, #1a1a1a);
  opacity: 0.55;
}

.workout-line-ctrl {
  display: inline-flex;
  width: 2.25rem;
  height: 2.25rem;
  min-width: 2.25rem;
  min-height: 2.25rem;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--color-base-content, #1a1a1a) 50%, transparent);
  border-radius: 0.5rem;
  background: var(--color-base-100, #fff);
  color: var(--color-base-content, #1a1a1a);
  font-size: 1.05rem;
  line-height: 1;
}

.workout-line-ctrl:hover:not(:disabled) {
  background: var(--color-base-200, #f3f4f6);
}

.workout-line-ctrl:disabled {
  opacity: 0.35;
}

.workout-line-ctrl--remove {
  color: var(--color-error, #dc2626);
}

button.journal-add-set.training-chip.btn {
  min-height: 0 !important;
  height: auto !important;
  padding: 0.1rem 0.55rem !important;
  font-size: 0.6875rem !important;
  line-height: 1rem !important;
}

.journal-exercise-title {
  margin: 0;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8125rem !important;
  font-weight: 600 !important;
  line-height: 1.2 !important;
  color: var(--color-primary, #06b6d4) !important;
}
</style>
