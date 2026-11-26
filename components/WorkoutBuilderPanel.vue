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
    <WorkoutBuilderEditor />
  </div>
</template>

<script setup>
const emit = defineEmits(["back"]);
const { confirm: askUser } = useConfirm();

const { draft, dirty, saving, listError, saveError, saveNotice, startNew, saveWorkout, deleteWorkout } =
  useWorkoutDraft();

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
