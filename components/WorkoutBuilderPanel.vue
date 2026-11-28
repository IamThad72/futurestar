<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="training-chip btn btn-ghost btn-sm rounded-full" :disabled="saving" @click="onBack">Workout Manager</button>
      <button
        type="button"
        class="training-chip btn btn-primary btn-sm rounded-full"
        :disabled="saving || !draft.name.trim()"
        @click="saveWorkout"
      >
        {{ saving ? "Saving…" : "Save" }}
      </button>
      <button
        v-if="draft.workoutId"
        type="button"
        class="training-chip btn btn-ghost btn-sm rounded-full text-red-600 dark:text-red-400"
        :disabled="saving"
        @click="onDelete"
      >
        Delete
      </button>
    </div>
    <p v-if="listError" class="text-sm text-error">{{ listError }}</p>
    <p v-if="saveError" class="text-sm text-error">{{ saveError }}</p>
    <p v-else-if="saveNotice" class="text-sm text-success">{{ saveNotice }}</p>
    <p v-if="draft.workoutId && draft.programs?.length" class="text-sm text-base-content/70">
      Edits apply everywhere this workout is used.
    </p>
    <p v-else-if="!draft.workoutId && linkedProgram" class="text-sm text-base-content/70">
      This workout will be added to {{ linkedProgram.name }}.
    </p>
    <div v-if="draft.programs?.length" class="flex flex-wrap gap-2">
      <span
        v-for="program in draft.programs"
        :key="program.programId"
        class="inline-flex min-h-11 items-center gap-1 rounded-full bg-base-200 px-3 text-sm text-base-content"
      >
        {{ program.name }}
        <button
          type="button"
          class="btn btn-ghost btn-sm min-h-11 min-w-11"
          :aria-label="`Remove from ${program.name}`"
          :disabled="saving"
          @click="removeDraftFromProgram(program.programId)"
        >
          ×
        </button>
      </span>
    </div>
    <select
      v-if="draft.workoutId && otherPrograms.length"
      class="select select-bordered min-h-11 w-full text-base"
      @change="onAddProgram"
    >
      <option value="">Add to program</option>
      <option v-for="program in otherPrograms" :key="program.programId" :value="program.programId">
        {{ program.name }}
      </option>
    </select>
    <WorkoutBuilderEditor />
  </div>
</template>

<script setup>
const emit = defineEmits(["back"]);
const { confirm: askUser } = useConfirm();

const {
  draft,
  dirty,
  saving,
  listError,
  saveError,
  saveNotice,
  programList,
  linkProgramId,
  startNew,
  saveWorkout,
  deleteWorkout,
  addDraftToProgram,
  removeDraftFromProgram,
} = useWorkoutDraft();

const linkedProgram = computed(() =>
  programList.value.programs.find((item) => item.programId === linkProgramId.value) || null,
);
const otherPrograms = computed(() => {
  const have = new Set((draft.value.programs || []).map((item) => item.programId));
  return (programList.value.programs || []).filter((item) => !have.has(item.programId));
});

function onAddProgram(event) {
  const programId = Number(event.target.value);
  event.target.value = "";
  if (programId) void addDraftToProgram(programId);
}

async function onBack() {
  if (saving.value) return;
  if (dirty.value) {
    saving.value = true;
    const discard = await askUser({
      header: "Discard changes?",
      message: "This workout has unsaved changes. Discard them?",
      confirmText: "Discard",
      destructive: true,
    });
    saving.value = false;
    if (!discard) return;
  }
  startNew();
  emit("back");
}

async function onDelete() {
  if (saving.value) return;
  saving.value = true;
  const remove = await askUser({
    header: "Delete workout?",
    message: "Delete this workout? This cannot be undone.",
    confirmText: "Delete",
    destructive: true,
  });
  if (!remove) {
    saving.value = false;
    return;
  }
  const ok = await deleteWorkout();
  saving.value = false;
  if (ok) emit("back");
}
</script>
