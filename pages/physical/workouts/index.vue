<template>
  <section class="app-page">
    <header class="mb-6">
      <h1 class="text-lg font-semibold text-base-content sm:text-xl">Workout Manager</h1>
      <p class="mt-1 text-sm text-base-content/60">
        {{
          editing
            ? "Set the exercises and one target each. Starting this plan in the Exercise Journal copies it. The saved plan stays as you left it."
            : "Open a saved plan, or start a new one. The Exercise Journal can start a session from any plan here."
        }}
      </p>
    </header>

    <WorkoutBuilderPanel v-if="editing" @back="editing = false" />

    <div v-else class="space-y-4">
      <button type="button" class="training-chip btn btn-primary btn-sm rounded-full" @click="onNew">
        New workout
      </button>
      <p v-if="listError || saveError" class="text-sm text-error">{{ listError || saveError }}</p>
      <p v-else-if="listLoading" class="text-sm text-base-content/60">Loading workouts…</p>
      <p v-else-if="!savedWorkouts.length" class="text-sm text-base-content/60">No saved workouts yet.</p>
      <ul v-else class="space-y-2">
        <li v-for="item in savedWorkouts" :key="item.workoutId">
          <button
            type="button"
            class="flex min-h-11 w-full items-center gap-3 rounded-lg border border-base-300 bg-base-100 px-4 py-3 text-left"
            @click="onOpen(item)"
          >
            <span class="min-w-0 flex-1 truncate text-sm font-semibold text-base-content">{{ item.name }}</span>
            <span class="text-sm text-base-content/60">
              {{ item.exerciseCount }} {{ item.exerciseCount === 1 ? "exercise" : "exercises" }}
            </span>
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
useHead({ title: "Workout Manager" });

const editing = ref(false);
const auth = useAuthStore();
const {
  savedWorkouts,
  listError,
  listLoading,
  saveError,
  dirty,
  startNew,
  ensureList,
  openWorkout,
  resetForUserChange,
} = useWorkoutDraft();

function onNew() {
  startNew();
  editing.value = true;
}

async function onOpen(item) {
  saveError.value = "";
  await openWorkout(item.workoutId);
  if (!saveError.value) editing.value = true;
}

onMounted(() => {
  void ensureList();
});

watch(
  () => auth.user?.user_id,
  (userId, previousId) => {
    if (userId === previousId) return;
    resetForUserChange();
    editing.value = false;
    if (userId) void ensureList();
  },
);

onBeforeRouteLeave(() => {
  if (!editing.value || !dirty.value) return true;
  return window.confirm("This workout has unsaved changes. Discard them?");
});
</script>
