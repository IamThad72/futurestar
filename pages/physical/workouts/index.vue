<template>
  <section class="app-page">
    <header class="page-header">
      <div class="page-header__copy">
        <h1>Workout Manager</h1>
        <p class="page-header__lede">
          {{
            editing
              ? "Set the exercises and one target each. Starting this workout in the Exercise Journal copies it."
              : "Group workouts into programs. Start a workout again from the Exercise Journal."
          }}
        </p>
      </div>
      <div v-if="!editing && (auth.user || auth.sessionEnded)" class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-primary min-h-11" @click="onNew">New workout</button>
        <button type="button" class="btn btn-ghost min-h-11" @click="onNewProgram">New program</button>
      </div>
    </header>

    <WorkoutBuilderPanel v-if="editing" @back="editing = false" />

    <div v-else class="space-y-4">
      <WorkoutPlanAssistant v-if="auth.user || auth.sessionEnded" @saved="loadList" />
      <LoadErrorPanel v-if="listError || saveError" :message="listError || saveError" :show-retry="Boolean(listError)" @retry="loadList" />
      <p v-else-if="listLoading" class="text-sm text-muted">Loading…</p>
      <EmptyState
        v-else-if="showEmpty"
        title="No programs yet."
        sentence="Create a program, or save a workout and add it later."
        :action="auth.user || auth.sessionEnded ? 'New program' : ''"
        @action="onNewProgram"
      />
      <WorkoutProgramBoard
        v-else
        :creating="creatingProgram"
        @open-workout="onOpen"
        @view-change="onViewChange"
        @cancel-create="creatingProgram = false"
      />
    </div>
  </section>
</template>

<script setup>
useHead({ title: "Workout Manager" });

const { confirm: askUser } = useConfirm();

const editing = ref(false);
const creatingProgram = ref(false);
const openedProgramId = ref(null);
const auth = useAuthStore();
const {
  programList,
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

const showEmpty = computed(
  () =>
    !creatingProgram.value &&
    !(programList.value.programs || []).length &&
    !(programList.value.unassigned?.workouts || []).length,
);

function onViewChange(payload) {
  openedProgramId.value = payload?.view === "program" ? payload.programId : null;
}

function onNew() {
  if (!auth.user) {
    saveError.value = auth.sessionEnded ? SESSION_ENDED_MESSAGE : SIGN_IN_MESSAGE;
    return;
  }
  creatingProgram.value = false;
  startNew(openedProgramId.value);
  editing.value = true;
}

function onNewProgram() {
  if (!auth.user) {
    saveError.value = auth.sessionEnded ? SESSION_ENDED_MESSAGE : SIGN_IN_MESSAGE;
    return;
  }
  creatingProgram.value = true;
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
    if (!userId && auth.sessionEnded) {
      if (editing.value) saveError.value = SESSION_ENDED_MESSAGE;
      return;
    }
    if (userId && !previousId && (editing.value || dirty.value)) {
      listError.value = "";
      void loadList();
      return;
    }
    resetForUserChange();
    editing.value = false;
    creatingProgram.value = false;
    openedProgramId.value = null;
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
