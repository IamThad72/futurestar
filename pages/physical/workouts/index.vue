<template>
  <section class="app-page">
    <header class="page-header">
      <div class="page-header__copy">
        <h1>Workout Manager</h1>
        <p class="page-header__lede">
          {{
            editing
              ? "Set the exercises and one target each. Starting this plan in the Exercise Journal copies it."
              : "Save a plan here, then start it again from the Exercise Journal."
          }}
        </p>
      </div>
      <button v-if="!editing && auth.user" type="button" class="btn btn-primary" @click="onNew">New workout</button>
    </header>

    <WorkoutBuilderPanel v-if="editing" @back="editing = false" />

    <div v-else class="space-y-4">
      <WorkoutPlanAssistant v-if="auth.user" @saved="loadList" />
      <LoadErrorPanel v-if="listError || saveError" :message="listError || saveError" :show-retry="Boolean(listError)" @retry="loadList" />
      <p v-else-if="listLoading" class="text-sm text-muted">Loading…</p>
      <EmptyState
        v-else-if="!savedWorkouts.length"
        title="No saved workouts yet."
        sentence="Start a plan you can open again from the Exercise Journal."
        :action="auth.user ? 'New workout' : ''"
        @action="onNew"
      />
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

const { confirm: askUser } = useConfirm();

const editing = ref(false);
const auth = useAuthStore();
const {
  savedWorkouts,
  listError,
  listLoading,
  saveError,
  dirty,
  loadList,
  startNew,
  ensureList,
  openWorkout,
  resetForUserChange,
} = useWorkoutDraft();

function onNew() {
  if (!auth.user) {
    saveError.value = SIGN_IN_MESSAGE;
    return;
  }
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
  () => auth.ready,
  (ready) => {
    if (ready) void ensureList();
  },
);

watch(
  () => auth.user?.user_id,
  (userId, previousId) => {
    if (userId === previousId) return;
    resetForUserChange();
    editing.value = false;
    if (userId) void ensureList();
  },
);

let discardPromptOpen = false;

onBeforeRouteLeave(() => {
  if (!editing.value || !dirty.value) return true;
  if (discardPromptOpen) return false;
  discardPromptOpen = true;
  return askUser({
    header: "Discard changes?",
    message: "This workout has unsaved changes. Discard them?",
    confirmText: "Discard",
    destructive: true,
  }).finally(() => {
    discardPromptOpen = false;
  });
});
</script>
