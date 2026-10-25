<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="training-chip btn btn-ghost btn-sm rounded-full" @click="onBack">Back</button>
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

const { draft, dirty, saving, listError, saveError, saveNotice, startNew, saveWorkout, deleteWorkout } =
  useWorkoutDraft();

function onBack() {
  if (dirty.value && !window.confirm("This workout has unsaved changes. Discard them?")) return;
  startNew();
  emit("back");
}

async function onDelete() {
  if (!window.confirm("Delete this workout? This cannot be undone.")) return;
  const ok = await deleteWorkout();
  if (ok) emit("back");
}
</script>
