<template>
  <div class="space-y-4">
    <label class="block text-sm font-medium text-base-content">
      Name
      <input
        v-model="draft.name"
        type="text"
        maxlength="120"
        class="input input-bordered mt-1 min-h-11 w-full text-base"
        placeholder="e.g. Pull day"
        @input="markDirty"
      />
    </label>

    <p v-if="!draft.exercises.length" class="text-sm text-base-content/60">
      Add the exercises for this plan. Each one keeps a single target. The journal expands that into set rows when you start it.
    </p>

    <ul v-else class="space-y-3">
      <li
        v-for="(item, index) in draft.exercises"
        :key="item.key"
        class="rounded-lg border border-base-300 bg-base-100 p-3"
      >
        <div class="flex items-start gap-2">
          <p class="min-w-0 flex-1 truncate pt-2 text-sm font-semibold text-base-content">{{ item.name }}</p>
          <div class="flex shrink-0 gap-1">
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
        <div class="mt-2 flex flex-wrap items-end gap-3">
          <label class="text-sm text-base-content/70">
            Sets
            <input
              :value="item.sets ?? ''"
              type="number"
              min="0"
              max="999"
              inputmode="numeric"
              class="input input-bordered set-field mt-1"
              aria-label="Sets"
              @input="updateThreeDigitField(item, 'sets', $event)"
            />
          </label>
          <label v-if="logsDuration(item)" class="text-sm text-base-content/70">
            Minutes
            <input
              :value="durationMinutes(item)"
              type="number"
              min="0"
              max="1440"
              step="0.01"
              inputmode="decimal"
              class="input input-bordered set-field mt-1"
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
              class="input input-bordered set-field mt-1"
              aria-label="Reps"
              @input="updateThreeDigitField(item, 'reps', $event)"
            />
          </label>
          <label v-if="usesLoadedWeight(item)" class="text-sm text-base-content/70">
            Weight
            <span class="mt-1 flex items-center gap-1">
              <input
                :value="item.weight ?? ''"
                type="number"
                min="0"
                max="999"
                step="0.5"
                inputmode="decimal"
                class="input input-bordered set-field"
                aria-label="Weight in pounds"
                @input="updateThreeDigitField(item, 'weight', $event)"
              />
              <span class="text-xs text-base-content/50">lb</span>
            </span>
          </label>
        </div>
      </li>
    </ul>

    <button type="button" class="training-chip btn btn-primary btn-sm rounded-full" @click="pickerOpen = true">
      Add exercise
    </button>

    <ExercisePicker v-model:open="pickerOpen" :added-ids="addedIds" @add="addExercise" />
  </div>
</template>

<script setup>
import {
  formatDurationMinutes,
  isTimeBasedExercise,
  limitMinuteInput,
  limitThreeDigitInput,
  minutesToDurationSeconds,
  usesLoadedWeight,
} from "~/utils/workoutDraft";

const { draft, addExercise, removeExercise, moveExercise, markDirty } = useWorkoutDraft();
const pickerOpen = ref(false);
const addedIds = computed(() => draft.value.exercises.map((item) => item.exerciseId).filter(Boolean));

function logsDuration(item) {
  return isTimeBasedExercise(item);
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
.set-field {
  width: 5rem;
  min-height: 2.75rem;
  padding-inline: 0.5rem;
  text-align: center;
  font-size: 1rem;
  appearance: textfield;
  -moz-appearance: textfield;
}

.set-field::-webkit-outer-spin-button,
.set-field::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
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
