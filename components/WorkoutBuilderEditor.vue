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
            class="rounded-md bg-base-100 py-2 pl-2 pr-1 outline outline-1 outline-base-300"
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
                <div
                  class="mt-2 grid gap-1.5"
                  :class="builderGridClass(item)"
                >
                  <label class="text-sm text-base-content/70">
                    Sets
                    <input
                      :value="item.sets ?? ''"
                      type="number"
                      min="0"
                      max="999"
                      inputmode="numeric"
                      class="input input-bordered input-sm compact-num-input mt-0.5 bg-base-100 text-base-content"
                      @input="updateThreeDigitField(item, 'sets', $event)"
                    />
                  </label>
                  <label v-if="logsDuration(item)" class="text-sm text-base-content/70">
                    Min
                    <input
                      :value="durationMinutes(item)"
                      type="number"
                      min="0"
                      max="1440"
                      step="0.01"
                      inputmode="decimal"
                      class="input input-bordered input-sm compact-min-input mt-0.5 bg-base-100 text-base-content"
                      aria-label="Minutes"
                      @input="updateDurationMinutes(item, $event)"
                    />
                  </label>
                  <label v-else class="text-sm text-base-content/70">
                    Reps
                    <input
                      :value="item.reps ?? ''"
                      type="number"
                      min="0"
                      max="999"
                      inputmode="numeric"
                      class="input input-bordered input-sm compact-num-input mt-0.5 bg-base-100 text-base-content"
                      @input="updateThreeDigitField(item, 'reps', $event)"
                    />
                  </label>
                  <label v-if="usesLoadedWeight(item)" class="text-sm text-base-content/70">
                    Wgt
                    <input
                      :value="item.weight ?? ''"
                      type="number"
                      min="0"
                      max="999"
                      step="0.5"
                      inputmode="decimal"
                      class="input input-bordered input-sm compact-num-input mt-0.5 bg-base-100 text-base-content"
                      aria-label="Weight in pounds"
                      @input="updateThreeDigitField(item, 'weight', $event)"
                    />
                  </label>
                </div>
              </div>
              <div class="flex shrink-0 flex-col gap-1">
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
import {
  formatDurationMinutes,
  isTimeBasedExercise,
  limitMinuteInput,
  limitThreeDigitInput,
  minutesToDurationSeconds,
  usesLoadedWeight,
} from "~/utils/workoutDraft";

defineProps({
  allowDrag: { type: Boolean, default: true },
  dropActive: { type: Boolean, default: false },
  emptyHint: { type: String, required: true },
});

defineEmits(["delete", "open-saved", "item-drag-start", "item-drag-end", "item-drag-over", "item-drop"]);

const { savedWorkouts, listError, draft, saving, saveError, saveNotice, removeExercise, moveExercise, markDirty } =
  useWorkoutDraft();

function logsDuration(item) {
  return isTimeBasedExercise(item);
}

function builderGridClass(item) {
  return usesLoadedWeight(item) ? "grid-cols-3" : "grid-cols-2";
}

function savedItemClass(item) {
  const current =
    draft.value.workoutId != null && Number(item.workoutId) === Number(draft.value.workoutId);
  return current
    ? "bg-base-200 text-base-content"
    : "text-base-content/70 hover:bg-base-200 hover:text-base-content";
}

function updateThreeDigitField(item, field, event) {
  const { text, value } = limitThreeDigitInput(event.target.value, { integer: field !== "weight" });
  event.target.value = text;
  item[field] = value;
  item.weightUnit = "lb";
  markDirty();
}

function durationMinutes(item) {
  return formatDurationMinutes(item.durationSeconds);
}

function updateDurationMinutes(item, event) {
  const { text, value } = limitMinuteInput(event.target.value);
  event.target.value = text;
  item.durationSeconds = minutesToDurationSeconds(value);
  item.reps = null;
  markDirty();
}
</script>

<style scoped>
.compact-num-input {
  width: 3.25rem;
  min-width: 3.25rem;
  max-width: 3.25rem;
  padding-inline: 0.35rem;
  text-align: center;
  appearance: textfield;
  -moz-appearance: textfield;
}

.compact-num-input::-webkit-outer-spin-button,
.compact-num-input::-webkit-inner-spin-button,
.compact-min-input::-webkit-outer-spin-button,
.compact-min-input::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}

.compact-min-input {
  width: 4.25rem;
  min-width: 4.25rem;
  max-width: 4.25rem;
  padding-inline: 0.35rem;
  text-align: center;
  appearance: textfield;
  -moz-appearance: textfield;
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
</style>
