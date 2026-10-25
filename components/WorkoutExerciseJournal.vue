<template>
  <div class="space-y-4">
    <section v-if="draft.sessionId" class="space-y-4">
      <div class="app-card space-y-3 px-4 py-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <label class="min-w-0 flex-1 text-sm font-medium text-base-content">
            Session name
            <input
              v-model.trim="draft.name"
              type="text"
              maxlength="120"
              class="input input-bordered mt-1 min-h-11 w-full text-base"
              required
              @input="markDirty"
            />
          </label>
          <div class="flex flex-wrap gap-2 pt-6">
            <button
              type="button"
              class="training-chip btn btn-primary btn-sm rounded-full"
              :disabled="saving || !sessionNameReady"
              @click="finishSession"
            >
              {{ saving ? "Saving…" : "Finish" }}
            </button>
            <button
              type="button"
              class="training-chip btn btn-ghost btn-sm rounded-full text-red-600 dark:text-red-400"
              :disabled="saving"
              @click="deleteSession"
            >
              Delete
            </button>
          </div>
        </div>
        <p class="text-sm text-base-content/60">
          {{ draft.workoutName ? `From plan: ${draft.workoutName}` : "Custom session" }}
          <span v-if="saveNotice" class="ml-2 text-success">{{ saveNotice }}</span>
          <span v-else-if="saving" class="ml-2">Saving…</span>
        </p>
        <label class="block max-w-sm text-sm font-medium text-base-content">
          When
          <input
            :value="toDatetimeLocalValue(draft.performedAt)"
            type="datetime-local"
            class="input input-bordered mt-1 min-h-11 w-full text-base"
            @input="draft.performedAt = fromDatetimeLocalValue($event.target.value); markDirty()"
          />
        </label>
        <details>
          <summary class="min-h-11 cursor-pointer text-sm font-medium text-base-content">Notes</summary>
          <textarea
            v-model="draft.notes"
            rows="2"
            class="textarea textarea-bordered mt-2 w-full text-base"
            @input="markDirty"
          />
        </details>
        <p v-if="saveError" class="text-sm text-error">{{ saveError }}</p>
      </div>

      <p v-if="!draft.exercises.length" class="text-sm text-base-content/60">
        Add an exercise to this session.
      </p>

      <article v-for="(item, index) in draft.exercises" :key="item.key" class="app-card px-4 py-4">
        <div class="flex items-start gap-2">
          <h3 class="min-w-0 flex-1 truncate pt-2 text-sm font-semibold text-base-content">
            {{ item.exerciseName }}
          </h3>
          <div class="flex shrink-0 gap-1">
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

        <ul class="mt-3 space-y-2">
          <li v-for="(set, setIndex) in item.sets" :key="set.key" class="flex flex-wrap items-center gap-2">
            <span class="w-8 text-sm tabular-nums text-base-content/50">{{ setIndex + 1 }}</span>
            <label v-if="item.logMode === 'reps'" class="flex items-center gap-1 text-sm text-base-content/70">
              <input
                :value="set.reps ?? ''"
                type="number"
                min="0"
                max="999"
                inputmode="numeric"
                class="input input-bordered set-field"
                aria-label="Reps"
                @input="updateSet(item, set, 'reps', $event)"
              />
              reps
            </label>
            <label v-if="usesLoadedWeight(item)" class="flex items-center gap-1 text-sm text-base-content/70">
              <input
                :value="set.weight ?? ''"
                type="number"
                min="0"
                max="999"
                step="0.5"
                inputmode="decimal"
                class="input input-bordered set-field"
                aria-label="Weight in pounds"
                @input="updateSet(item, set, 'weight', $event)"
              />
              lb
            </label>
            <label v-if="item.logMode === 'duration'" class="flex items-center gap-1 text-sm text-base-content/70">
              <input
                :value="durationMinutes(set)"
                type="number"
                min="0"
                max="1440"
                step="0.01"
                inputmode="decimal"
                class="input input-bordered set-field"
                aria-label="Minutes"
                @input="setDurationMinutes(item, set, $event)"
              />
              min
            </label>
            <span v-if="previousText(item, setIndex)" class="text-sm text-base-content/50">
              {{ previousText(item, setIndex) }}
            </span>
            <button
              type="button"
              class="training-chip btn btn-ghost btn-xs rounded-full"
              :disabled="item.sets.length <= 1"
              aria-label="Remove set"
              @click="removeSet(item, set.key)"
            >
              ×
            </button>
          </li>
        </ul>
        <button type="button" class="journal-add-set training-chip btn btn-primary btn-xs rounded-full" @click="addSet(item)">
          Add set
        </button>
      </article>

      <button type="button" class="training-chip btn btn-primary btn-sm rounded-full" @click="pickerOpen = true">
        Add exercise
      </button>
    </section>

    <section v-else class="space-y-6">
      <div class="space-y-3">
        <h2 class="text-sm font-semibold text-base-content">Start</h2>
        <button type="button" class="training-chip btn btn-primary btn-sm rounded-full" :disabled="saving" @click="startEmpty">
          {{ startingId === "empty" ? "Starting…" : "Start empty" }}
        </button>
        <p v-if="saveError" class="text-sm text-error">{{ saveError }}</p>
      </div>

      <div class="space-y-3">
        <h2 class="text-sm font-semibold text-base-content">Saved workouts</h2>
        <p v-if="workoutsError" class="text-sm text-warning">{{ workoutsError }}</p>
        <p v-else-if="!savedWorkouts.length" class="text-sm text-base-content/60">
          No saved workouts yet. Build one in Workout Manager, then start it here.
        </p>
        <ul v-else class="space-y-2">
          <li v-for="workout in savedWorkouts" :key="workout.workoutId">
            <button
              type="button"
              class="flex min-h-11 w-full items-center gap-3 rounded-lg border border-base-300 bg-base-100 px-4 py-3 text-left"
              :disabled="saving"
              @click="startFromWorkout(workout)"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold text-base-content">{{ workout.name }}</span>
                <span class="text-xs text-base-content/60">
                  {{ workout.exerciseCount }} {{ workout.exerciseCount === 1 ? "exercise" : "exercises" }}
                </span>
              </span>
              <span class="text-sm font-medium text-primary">
                {{ startingId === String(workout.workoutId) ? "Starting…" : "Start" }}
              </span>
            </button>
          </li>
        </ul>
      </div>

      <div class="space-y-3">
        <h2 class="text-sm font-semibold text-base-content">Session History</h2>
        <p v-if="listError" class="text-sm text-error">{{ listError }}</p>
        <p v-else-if="listLoading && !sessions.length" class="text-sm text-base-content/60">Loading sessions…</p>
        <p v-else-if="!sessions.length" class="text-sm text-base-content/60">No sessions yet.</p>
        <section v-for="group in groupedHistory" :key="group.key" class="space-y-2">
          <h3 v-if="group.label" class="text-xs font-semibold uppercase tracking-wide text-base-content/50">{{ group.label }}</h3>
          <ul class="space-y-2">
            <li v-for="item in group.sessions" :key="item.sessionId">
              <button
                type="button"
                class="flex min-h-11 w-full flex-col items-start rounded-lg border border-base-300 bg-base-100 px-4 py-3 text-left"
                @click="openSession(item.sessionId)"
              >
                <span class="truncate text-sm font-semibold text-base-content">{{ sessionTitle(item) }}</span>
                <span class="text-xs text-base-content/60">
                  {{ formatWhen(item.performedAt) }} · {{ item.exerciseCount }}
                  {{ item.exerciseCount === 1 ? "exercise" : "exercises" }}
                </span>
              </button>
            </li>
          </ul>
        </section>
      </div>
    </section>

    <ExercisePicker v-model:open="pickerOpen" :added-ids="addedExerciseIds" @add="addCatalogExercise" />
  </div>
</template>

<script setup>
import { parseFetchError } from "~/utils/parseFetchError";
import {
  formatDurationMinutes,
  isTimeBasedExercise,
  limitMinuteInput,
  limitThreeDigitInput,
  minutesToDurationSeconds,
  payloadFromExercise,
  usesLoadedWeight,
  weightInLb,
} from "~/utils/workoutDraft";

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
  const date = Number.isNaN(d.getTime()) ? new Date() : d;
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const sessions = ref([]);
const listLoading = ref(false);
const listError = ref("");
const savedWorkouts = ref([]);
const workoutsError = ref("");
const saving = ref(false);
const saveError = ref("");
const saveNotice = ref("");
const dirty = ref(false);
const startingId = ref("");
const pickerOpen = ref(false);
const previousByExercise = ref({});
const draft = ref(emptyDraft());

let lineSeq = 0;
let saveTimer;
let applyingServer = false;

const sessionNameReady = computed(() => Boolean(String(draft.value.name || "").trim()));
const addedExerciseIds = computed(() => draft.value.exercises.map((item) => item.exerciseId).filter(Boolean));

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
  if (earlier.length) groups.push({ key: "earlier", label: "", sessions: earlier });
  return groups;
});

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

function previousText(item, setIndex) {
  const prev = previousByExercise.value[item.exerciseId];
  if (!prev?.sets?.length) return "";
  const set = prev.sets[setIndex] || prev.sets[prev.sets.length - 1];
  if (!set) return "";
  if (item.logMode === "duration") {
    const minutes = formatDurationMinutes(set.durationSeconds);
    return minutes ? `last ${minutes} min` : "";
  }
  const weight = weightInLb(set.weight, set.weightUnit);
  if (weight != null && set.reps != null) return `last ${weight}×${set.reps}`;
  if (set.reps != null) return `last ${set.reps} reps`;
  if (weight != null && usesLoadedWeight(item)) return `last ${weight} lb`;
  return "";
}

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
  if (!draft.value.sessionId || !sessionNameReady.value) return;
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

async function loadPrevious() {
  try {
    const data = await $fetch("/api/physical/journal/previous", {
      query: draft.value.sessionId ? { exclude: draft.value.sessionId } : undefined,
    });
    const map = {};
    for (const item of data.previous || []) {
      if (item?.exerciseId) map[item.exerciseId] = item;
    }
    previousByExercise.value = map;
  } catch {
    previousByExercise.value = {};
  }
}

async function createSession(body, startKey) {
  if (saving.value) return;
  saving.value = true;
  startingId.value = startKey;
  saveError.value = "";
  try {
    const data = await $fetch("/api/physical/journal", { method: "POST", body });
    applySession(data.session);
    saveNotice.value = "Started.";
    await Promise.all([loadHistory(), loadPrevious()]);
  } catch (error) {
    saveError.value = parseFetchError(error, "Could not start this session.");
  } finally {
    saving.value = false;
    startingId.value = "";
  }
}

function startEmpty() {
  return createSession(
    {
      performedAt: new Date().toISOString(),
      name: "Workout",
      workoutId: null,
      exercises: [],
    },
    "empty",
  );
}

function startFromWorkout(workout) {
  return createSession(
    {
      performedAt: new Date().toISOString(),
      name: workout.name,
      workoutId: workout.workoutId,
      exercises: [],
    },
    String(workout.workoutId),
  );
}

async function openSession(sessionId) {
  if (draft.value.sessionId === sessionId) return;
  if (dirty.value) await saveSession();
  saveError.value = "";
  try {
    const data = await $fetch(`/api/physical/journal/${sessionId}`);
    applySession(data.session);
    saveNotice.value = "";
    await loadPrevious();
  } catch (error) {
    saveError.value = parseFetchError(error, "Could not open that session.");
  }
}

async function finishSession() {
  clearTimeout(saveTimer);
  if (!sessionNameReady.value) {
    saveError.value = "Session name is required.";
    return;
  }
  const ok = await saveSession();
  if (!ok) return;
  closeEditor();
}

async function saveSession() {
  if (!draft.value.sessionId) return false;
  if (!sessionNameReady.value) {
    saveError.value = "Session name is required.";
    return false;
  }
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

function closeEditor() {
  clearTimeout(saveTimer);
  pickerOpen.value = false;
  draft.value = emptyDraft();
  dirty.value = false;
  saveError.value = "";
  saveNotice.value = "";
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
    sets: Array.from({ length: setCount }, () => emptySet(template)),
  });
  markDirty();
}

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
.set-field {
  width: 5rem;
  min-height: 2.75rem;
  padding-inline: 0.5rem;
  text-align: center;
  font-size: 1rem;
  appearance: textfield;
  -moz-appearance: textfield;
}

.set-field::-webkit-outer-spin-button,
.set-field::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
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
</style>
