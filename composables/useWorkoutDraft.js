import { parseFetchError } from "~/utils/parseFetchError";
import { catalogExerciseId, payloadFromExercise } from "~/utils/workoutDraft";

const savedWorkouts = ref([]);
const listError = ref("");
const listLoading = ref(false);

const draft = ref(emptyDraft());
const dirty = ref(false);
const saving = ref(false);
const saveError = ref("");
const saveNotice = ref("");
const collapsed = ref(false);
const catalogDragging = ref(false);
const lastAddedName = ref("");
let lastAddedTimer;

let lineSeq = 0;
let listLoaded = false;

function emptyDraft() {
  return {
    workoutId: null,
    name: "",
    notes: "",
    exercises: [],
  };
}

function nextLineKey() {
  lineSeq += 1;
  return `we-${Date.now()}-${lineSeq}`;
}

function lineFromPayload(payload, existing) {
  return {
    key: existing?.key || nextLineKey(),
    workoutExerciseId: existing?.workoutExerciseId ?? null,
    exerciseId: payload.exerciseId,
    name: payload.name || existing?.name || payload.exerciseId,
    gifUrl: payload.gifUrl || existing?.gifUrl || "",
    sets: payload.sets ?? existing?.sets ?? 3,
    reps: payload.reps ?? existing?.reps ?? 8,
    weight: payload.weight ?? existing?.weight ?? null,
    weightUnit: payload.weightUnit || existing?.weightUnit || "lb",
    durationSeconds: payload.durationSeconds ?? existing?.durationSeconds ?? null,
  };
}

function applyWorkout(workout) {
  draft.value = {
    workoutId: workout.workoutId,
    name: workout.name || "",
    notes: workout.notes || "",
    exercises: (workout.exercises || []).map((item) =>
      lineFromPayload(
        {
          exerciseId: item.exerciseId,
          name: item.name,
          gifUrl: item.gifUrl,
          sets: item.sets,
          reps: item.reps,
          weight: item.weight,
          weightUnit: item.weightUnit,
          durationSeconds: item.durationSeconds,
        },
        { key: nextLineKey(), workoutExerciseId: item.workoutExerciseId },
      ),
    ),
  };
  dirty.value = false;
  saveError.value = "";
}

function payloadForSave() {
  return {
    name: draft.value.name,
    notes: draft.value.notes,
    exercises: draft.value.exercises.map((item) => ({
      exerciseId: item.exerciseId,
      sets: item.sets == null || item.sets === "" ? null : Math.round(Number(item.sets)),
      reps: item.reps == null || item.reps === "" ? null : Math.round(Number(item.reps)),
      weight: item.weight == null || item.weight === "" ? null : Number(item.weight),
      weightUnit: item.weightUnit,
      durationSeconds:
        item.durationSeconds == null || item.durationSeconds === ""
          ? null
          : Math.round(Number(item.durationSeconds)),
    })),
  };
}

export function useWorkoutDraft() {
  function markDirty() {
    dirty.value = true;
    saveNotice.value = "";
  }

  function resetForUserChange() {
    draft.value = emptyDraft();
    dirty.value = false;
    saveError.value = "";
    saveNotice.value = "";
    savedWorkouts.value = [];
    listError.value = "";
    listLoaded = false;
  }

  function noteAdded(name) {
    lastAddedName.value = name;
    if (!import.meta.client) return;
    clearTimeout(lastAddedTimer);
    lastAddedTimer = setTimeout(() => {
      lastAddedName.value = "";
    }, 2500);
  }

  function expandPanel() {
    collapsed.value = false;
    if (!import.meta.client) return;
    if (window.matchMedia("(max-width: 1023px)").matches) return;
    document.getElementById("workout-manager-drop")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }

  function addExercise(exercise) {
    const payload = payloadFromExercise(exercise);
    if (!payload.exerciseId) {
      saveError.value = "That exercise is not in the catalog yet, so it cannot be saved to a workout.";
      expandPanel();
      return false;
    }
    draft.value.exercises.push(lineFromPayload(payload));
    markDirty();
    noteAdded(payload.name);
    expandPanel();
    return true;
  }

  function addPayload(payload) {
    const exerciseId = catalogExerciseId(payload);
    if (!exerciseId) return false;
    draft.value.exercises.push(lineFromPayload({ ...payload, exerciseId }));
    markDirty();
    noteAdded(payload.name || exerciseId);
    expandPanel();
    return true;
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

  function startNew() {
    draft.value = emptyDraft();
    dirty.value = false;
    saveError.value = "";
    saveNotice.value = "";
    expandPanel();
  }

  async function loadList() {
    listLoading.value = true;
    listError.value = "";
    try {
      const data = await $fetch("/api/physical/workouts");
      savedWorkouts.value = data.workouts || [];
      listLoaded = true;
    } catch (error) {
      listError.value = parseFetchError(error, "Could not load saved workouts.");
    } finally {
      listLoading.value = false;
    }
  }

  async function ensureList() {
    if (!listLoaded && !listLoading.value) await loadList();
  }

  async function openWorkout(workoutId) {
    const id = Number(workoutId);
    if (!Number.isInteger(id) || id <= 0) return;
    saveError.value = "";
    try {
      const data = await $fetch(`/api/physical/workouts/${id}`);
      applyWorkout(data.workout);
      expandPanel();
    } catch (error) {
      saveError.value = parseFetchError(error, "Could not open that workout.");
    }
  }

  async function saveWorkout() {
    const name = String(draft.value.name || "").trim();
    if (!name) {
      saveError.value = "Name this workout before saving.";
      expandPanel();
      return false;
    }
    saving.value = true;
    saveError.value = "";
    saveNotice.value = "";
    try {
      const body = payloadForSave();
      const data = draft.value.workoutId
        ? await $fetch(`/api/physical/workouts/${draft.value.workoutId}`, { method: "PUT", body })
        : await $fetch("/api/physical/workouts", { method: "POST", body });
      applyWorkout(data.workout);
      saveNotice.value = "Saved.";
      await loadList();
      return true;
    } catch (error) {
      saveError.value = parseFetchError(error, "Could not save this workout.");
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function deleteWorkout() {
    const id = draft.value.workoutId;
    if (!id) {
      startNew();
      return true;
    }
    saving.value = true;
    saveError.value = "";
    try {
      await $fetch(`/api/physical/workouts/${id}`, { method: "DELETE" });
      startNew();
      await loadList();
      saveNotice.value = "Workout deleted.";
      return true;
    } catch (error) {
      saveError.value = parseFetchError(error, "Could not delete this workout.");
      return false;
    } finally {
      saving.value = false;
    }
  }

  function beginCatalogDrag() {
    catalogDragging.value = true;
  }

  function endCatalogDrag() {
    catalogDragging.value = false;
  }

  return {
    savedWorkouts,
    listError,
    listLoading,
    draft,
    dirty,
    saving,
    saveError,
    saveNotice,
    collapsed,
    catalogDragging,
    lastAddedName,
    addExercise,
    addPayload,
    removeExercise,
    moveExercise,
    startNew,
    loadList,
    ensureList,
    openWorkout,
    saveWorkout,
    deleteWorkout,
    expandPanel,
    resetForUserChange,
    beginCatalogDrag,
    endCatalogDrag,
    markDirty,
  };
}
