<template>
  <div class="flex min-h-0 flex-1 flex-col gap-y-6 px-3 py-4 sm:px-6">
    <div class="flex min-h-0 flex-1 flex-col rounded-md bg-base-100">
      <label class="block text-xs font-semibold text-base-content/70">
        Name
        <input
          v-model="draft.name"
          type="text"
          maxlength="120"
          class="input input-bordered input-sm mt-1 w-full bg-base-100 text-base-content"
          placeholder="e.g. Pull day"
          @input="markDirty"
        />
      </label>

      <p v-if="listError" class="mt-2 text-xs text-error">{{ listError }}</p>
      <p v-if="saveError" class="mt-2 text-xs text-error">{{ saveError }}</p>
      <p v-else-if="saveNotice" class="mt-2 text-xs text-success">{{ saveNotice }}</p>

      <div
        class="mt-3 flex flex-1 flex-col rounded-md border border-dashed px-2 py-3"
        :class="[
          dropActive ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-100',
          allowDrag ? 'min-h-64' : 'min-h-0',
        ]"
      >
        <p
          v-if="!draft.exercises.length"
          class="m-auto px-2 py-6 text-center text-sm text-base-content/60"
        >
          {{ emptyHint }}
        </p>
        <ul v-else class="w-full space-y-2">
          <li
            v-for="(item, index) in draft.exercises"
            :key="item.key"
            class="rounded-md bg-base-100 p-2 outline outline-1 outline-base-300"
            @dragover.prevent="allowDrag ? $emit('item-drag-over') : undefined"
            @drop.prevent="allowDrag ? $emit('item-drop', $event, index) : undefined"
          >
            <div class="flex items-start gap-2">
              <div class="min-w-0 flex-1">
                <div class="flex min-h-11 items-center gap-2">
                  <button
                    v-if="allowDrag"
                    type="button"
                    class="inline-flex size-11 shrink-0 cursor-grab items-center justify-center rounded-md text-base-content/50 hover:bg-base-200 hover:text-base-content"
                    draggable="true"
                    :aria-label="`Reorder ${item.name}`"
                    @dragstart="$emit('item-drag-start', $event, index)"
                    @dragend="$emit('item-drag-end')"
                  >
                    <Bars2Icon class="size-6" aria-hidden="true" />
                  </button>
                  <span class="min-w-0 flex-1 truncate text-sm font-semibold text-base-content">{{
                    item.name
                  }}</span>
                </div>
                <div class="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  <label class="text-sm text-base-content/70">
                    Sets
                    <input
                      :value="item.sets ?? ''"
                      type="number"
                      min="0"
                      max="99"
                      class="input input-bordered input-sm mt-0.5 w-full bg-base-100 text-base-content"
                      @input="updateLine(item, 'sets', $event.target.value)"
                    />
                  </label>
                  <label class="text-sm text-base-content/70">
                    Reps
                    <input
                      :value="item.reps ?? ''"
                      type="number"
                      min="0"
                      max="999"
                      class="input input-bordered input-sm mt-0.5 w-full bg-base-100 text-base-content"
                      @input="updateLine(item, 'reps', $event.target.value)"
                    />
                  </label>
                  <label class="text-sm text-base-content/70">
                    Weight
                    <input
                      :value="item.weight ?? ''"
                      type="number"
                      min="0"
                      max="9999"
                      step="0.5"
                      class="input input-bordered input-sm mt-0.5 w-full bg-base-100 text-base-content"
                      @input="updateLine(item, 'weight', $event.target.value)"
                    />
                  </label>
                  <label class="text-sm text-base-content/70">
                    Unit
                    <select
                      :value="item.weightUnit"
                      class="select select-bordered select-sm mt-0.5 w-full bg-base-100 text-base-content"
                      @change="updateLine(item, 'weightUnit', $event.target.value)"
                    >
                      <option value="lb">lb</option>
                      <option value="kg">kg</option>
                    </select>
                  </label>
                </div>
                <label
                  v-if="item.durationSeconds != null"
                  class="mt-1.5 block text-[11px] text-base-content/70"
                >
                  Duration (sec)
                  <input
                    :value="item.durationSeconds ?? ''"
                    type="number"
                    min="0"
                    max="86400"
                    class="input input-bordered input-xs mt-0.5 w-full bg-base-100 text-base-content"
                    @input="updateLine(item, 'durationSeconds', $event.target.value)"
                  />
                </label>
              </div>
              <div class="flex flex-col gap-1">
                <button
                  type="button"
                  class="btn btn-ghost btn-square workout-line-ctrl text-base-content/60 hover:bg-base-200 hover:text-base-content"
                  :disabled="index === 0"
                  aria-label="Move up"
                  @click="moveExercise(index, index - 1)"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-square workout-line-ctrl text-base-content/60 hover:bg-base-200 hover:text-base-content"
                  :disabled="index === draft.exercises.length - 1"
                  aria-label="Move down"
                  @click="moveExercise(index, index + 1)"
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-square workout-line-ctrl text-error hover:bg-base-200"
                  aria-label="Remove exercise"
                  @click="removeExercise(item.key)"
                >
                  ×
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <div v-if="draft.workoutId" class="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-ghost btn-sm min-h-9 text-error hover:bg-base-200"
          :disabled="saving"
          @click="$emit('delete')"
        >
          Delete
        </button>
      </div>
    </div>

    <div>
      <div class="text-xs font-semibold text-base-content/70">Saved workouts</div>
      <ul v-if="savedWorkouts.length" role="list" class="-mx-2 mt-2 space-y-1">
        <li v-for="item in savedWorkouts" :key="item.workoutId">
          <button
            type="button"
            class="group flex w-full items-center gap-x-3 rounded-md p-2 text-left text-sm font-semibold"
            :class="savedItemClass(item)"
            @click="$emit('open-saved', item)"
          >
            <span class="truncate">{{ item.name }}</span>
            <span
              class="ml-auto w-9 min-w-max rounded-full bg-base-200 px-2.5 py-0.5 text-center text-xs font-medium text-base-content outline outline-1 outline-base-300"
            >
              {{ item.exerciseCount }}
            </span>
          </button>
        </li>
      </ul>
      <p v-else class="mt-2 text-sm text-base-content/60">No saved workouts yet</p>
    </div>
  </div>
</template>

<script setup>
import { Bars2Icon } from "@heroicons/vue/24/outline";

defineProps({
  allowDrag: { type: Boolean, default: true },
  dropActive: { type: Boolean, default: false },
  emptyHint: { type: String, required: true },
});

defineEmits(["delete", "open-saved", "item-drag-start", "item-drag-end", "item-drag-over", "item-drop"]);

const { savedWorkouts, listError, draft, saving, saveError, saveNotice, removeExercise, moveExercise, markDirty } =
  useWorkoutDraft();

function savedItemClass(item) {
  const current =
    draft.value.workoutId != null && Number(item.workoutId) === Number(draft.value.workoutId);
  return current
    ? "bg-base-200 text-base-content"
    : "text-base-content/70 hover:bg-base-200 hover:text-base-content";
}

function updateLine(item, field, raw) {
  if (field === "weightUnit") {
    item.weightUnit = raw === "kg" ? "kg" : "lb";
  } else if (raw === "") {
    item[field] = null;
  } else {
    const n = Number(raw);
    item[field] = Number.isFinite(n) ? n : null;
  }
  markDirty();
}
</script>

<style scoped>
.workout-line-ctrl {
  width: 2.75rem;
  height: 2.75rem;
  min-width: 2.75rem;
  min-height: 2.75rem;
  padding: 0;
  font-size: 1.25rem;
  line-height: 1;
}

@media (min-width: 1024px) {
  .workout-line-ctrl {
    width: 3.6rem;
    height: 3.6rem;
    min-width: 3.6rem;
    min-height: 3.6rem;
    font-size: 1.65rem;
  }
}
</style>
