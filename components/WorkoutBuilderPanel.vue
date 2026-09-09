<template>
  <nav v-if="picking" class="workout-dock">
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-semibold text-base-content">
        {{ draft.name.trim() || "Untitled workout" }}
      </p>
      <p class="truncate text-xs text-base-content/60">
        <template v-if="lastAddedName">Added {{ lastAddedName }}</template>
        <template v-else>{{ exerciseCountLabel }}</template>
      </p>
    </div>
    <button type="button" class="btn btn-ghost btn-sm min-h-10" @click="sheetOpen = true">
      Edit
    </button>
    <button
      type="button"
      class="btn btn-accent btn-sm min-h-10"
      :disabled="saving || !draft.name.trim()"
      @click="saveWorkout"
    >
      {{ saving ? "Saving…" : "Save" }}
    </button>
  </nav>

  <div v-if="picking" class="modal modal-bottom" :class="{ 'modal-open': sheetOpen }">
    <div class="modal-box max-h-[85vh] overflow-y-auto p-0">
      <div class="sticky top-0 z-10 flex items-center gap-2 border-b border-base-300 bg-base-100 px-3 py-3">
        <h2 class="min-w-0 flex-1 text-sm font-semibold">Edit workout</h2>
        <button type="button" class="btn btn-ghost btn-sm" @click="onNew">New</button>
        <button
          type="button"
          class="btn btn-accent btn-sm"
          :disabled="saving || !draft.name.trim()"
          @click="saveWorkout"
        >
          {{ saving ? "Saving…" : "Save" }}
        </button>
        <button type="button" class="btn btn-ghost btn-sm btn-square" aria-label="Close" @click="sheetOpen = false">
          ×
        </button>
      </div>
      <WorkoutBuilderEditor
        :allow-drag="false"
        :empty-hint="emptyHint"
        @delete="onDelete"
        @open-saved="onOpenSaved"
      />
    </div>
    <button type="button" class="modal-backdrop bg-black/40" aria-label="Close editor" @click="sheetOpen = false" />
  </div>

  <aside
    v-else
    id="workout-manager-drop"
    class="workout-frame relative flex flex-col overflow-hidden rounded-lg border border-base-300 bg-base-100"
    :class="{ 'workout-frame--drop': dropActive, 'workout-frame--compact': preferTapAdd }"
    @dragover.prevent="allowDrag ? onDragOver() : undefined"
    @dragleave="allowDrag ? onDragLeave($event) : undefined"
    @drop.prevent="allowDrag ? onDrop($event) : undefined"
  >
    <div class="relative flex flex-wrap items-center gap-2 border-b border-base-300 px-1 py-3 text-base-content sm:px-6">
      <h2 class="min-w-0 flex-1 text-sm font-semibold">Workout Builder</h2>
      <div class="workout-frame__actions flex items-center gap-2">
        <button type="button" class="btn btn-ghost" @click="onNew">New</button>
        <button
          type="button"
          class="btn btn-accent"
          :disabled="saving || !draft.name.trim()"
          @click="saveWorkout"
        >
          {{ saving ? "Saving…" : "Save" }}
        </button>
      </div>
    </div>

    <div class="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <WorkoutBuilderEditor
        :allow-drag="allowDrag"
        :drop-active="dropActive"
        :empty-hint="emptyHint"
        @delete="onDelete"
        @open-saved="onOpenSaved"
        @item-drag-start="onItemDragStart"
        @item-drag-end="onItemDragEnd"
        @item-drag-over="onItemDragOver"
        @item-drop="onItemDrop"
      />
    </div>
  </aside>
</template>

<script setup>
import { readDragPayload, WORKOUT_ITEM_DND } from "~/utils/workoutDraft";

const {
  draft,
  dirty,
  saving,
  lastAddedName,
  catalogDragging,
  addPayload,
  startNew,
  ensureList,
  openWorkout,
  saveWorkout,
  deleteWorkout,
  resetForUserChange,
  moveExercise,
} = useWorkoutDraft();

const auth = useAuthStore();
const route = useRoute();
const { preferTapAdd } = useMobileShell();

const dropDepth = ref(0);
const reorderFrom = ref(null);
const sheetOpen = ref(false);
const dropActive = computed(() => allowDrag.value && (catalogDragging.value || dropDepth.value > 0));
const allowDrag = computed(() => !preferTapAdd.value);
const browsingCatalog = computed(() => /^\/physical\/workouts\/[^/]+/.test(route.path));
const picking = computed(() => preferTapAdd.value && browsingCatalog.value);
const emptyHint = computed(() =>
  allowDrag.value
    ? "Drag an exercise here, or tap Add on a training card."
    : "Open a training list and tap Add on an exercise.",
);
const exerciseCountLabel = computed(() => {
  const n = draft.value.exercises.length;
  return n === 1 ? "1 exercise" : `${n} exercises`;
});

onMounted(() => {
  void ensureList();
});

watch(
  () => auth.user?.user_id,
  (userId, previousId) => {
    if (userId === previousId) return;
    resetForUserChange();
    if (userId) void ensureList();
  },
);

watch(picking, (isPicking) => {
  if (!isPicking) sheetOpen.value = false;
});

function confirmLeave() {
  if (!dirty.value) return true;
  return window.confirm("This workout has unsaved changes. Discard them?");
}

function onNew() {
  if (!confirmLeave()) return;
  startNew();
}

async function onOpenSaved(item) {
  if (Number(item.workoutId) === Number(draft.value.workoutId)) return;
  if (!confirmLeave()) return;
  await openWorkout(item.workoutId);
}

function onDelete() {
  if (!window.confirm("Delete this workout? This cannot be undone.")) return;
  void deleteWorkout();
}

function onDragOver() {
  dropDepth.value = 1;
}

function onDragLeave(event) {
  if (event.currentTarget.contains(event.relatedTarget)) return;
  dropDepth.value = 0;
}

function onDrop(event) {
  dropDepth.value = 0;
  const from = event.dataTransfer?.getData(WORKOUT_ITEM_DND);
  if (from) return;
  const payload = readDragPayload(event);
  if (payload) addPayload(payload);
}

function onItemDragStart(event, index) {
  reorderFrom.value = index;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(WORKOUT_ITEM_DND, String(index));
  event.dataTransfer.setData("text/plain", String(index));
}

function onItemDragEnd() {
  reorderFrom.value = null;
}

function onItemDragOver() {}

function onItemDrop(event, toIndex) {
  event.stopPropagation();
  dropDepth.value = 0;
  const fromRaw = event.dataTransfer?.getData(WORKOUT_ITEM_DND);
  if (fromRaw) {
    const fromIndex = Number(fromRaw);
    if (Number.isInteger(fromIndex)) moveExercise(fromIndex, toIndex);
    return;
  }
  const payload = readDragPayload(event);
  if (!payload) return;
  addPayload(payload);
  const last = draft.value.exercises.length - 1;
  if (last > toIndex) moveExercise(last, toIndex);
}
</script>

<style scoped>
.workout-frame {
  width: 100%;
  min-height: 28rem;
}

.workout-frame--compact {
  min-height: 0;
}

.workout-frame--drop {
  outline: 2px solid var(--color-primary, #06b6d4);
  outline-offset: -1px;
}

.workout-dock {
  position: fixed;
  right: 0;
  bottom: calc(1.75rem + env(safe-area-inset-bottom, 0));
  left: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-top: 1px solid var(--color-base-300, #babebe);
  background: var(--color-base-100, #ffffff);
  padding: 0.75rem 1rem;
}

@media (min-width: 1024px) {
  .workout-frame {
    min-height: calc(100svh - 12rem);
  }
}
</style>
