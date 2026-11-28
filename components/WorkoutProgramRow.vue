<template>
  <div class="rounded-lg border border-base-300 bg-base-100 p-2">
    <div class="flex min-h-11 items-stretch gap-1">
      <label v-if="checkable" class="flex min-h-11 items-center px-2">
        <input
          type="checkbox"
          class="checkbox"
          :checked="checked"
          :aria-label="`Select ${workout.name}`"
          @change="$emit('toggle', $event.target.checked)"
        />
      </label>
      <button type="button" class="min-h-11 min-w-0 flex-1 px-2 py-2 text-left" @click="$emit('open')">
        <span class="block truncate text-sm font-semibold text-base-content">{{ workout.name }}</span>
        <span v-if="workout.programs?.length" class="mt-1 flex flex-wrap gap-1">
          <span
            v-for="chip in workout.programs"
            :key="chip.programId"
            class="rounded-full bg-base-200 px-2 py-0.5 text-xs text-base-content/80"
          >
            {{ chip.name }}
          </span>
        </span>
        <span class="text-xs text-base-content/60">
          {{ workout.exerciseCount }} {{ workout.exerciseCount === 1 ? "exercise" : "exercises" }}
        </span>
      </button>
      <div v-if="showReorder" class="flex shrink-0 items-center">
        <button
          type="button"
          class="btn btn-ghost btn-sm min-h-11 min-w-11"
          aria-label="Move up"
          :disabled="acting"
          @click="$emit('move', -1)"
        >
          ↑
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm min-h-11 min-w-11"
          aria-label="Move down"
          :disabled="acting"
          @click="$emit('move', 1)"
        >
          ↓
        </button>
      </div>
    </div>
    <div v-if="showRemove" class="px-2 pb-2">
      <button type="button" class="btn btn-ghost min-h-11 w-full text-error" :disabled="acting" @click="$emit('remove')">
        Remove from this program
      </button>
    </div>
    <div v-if="!checkable && addable.length" class="px-2 pb-2">
      <button v-if="addFor !== workout.workoutId" type="button" class="btn btn-ghost btn-sm min-h-11" @click="addFor = workout.workoutId">
        Add to program
      </button>
      <select
        v-else
        class="select select-bordered min-h-11 w-full text-base"
        @change="onAdd"
      >
        <option value="">Add to program</option>
        <option v-for="program in addable" :key="program.programId" :value="program.programId">
          {{ program.name }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  workout: { type: Object, required: true },
  programs: { type: Array, default: () => [] },
  acting: { type: Boolean, default: false },
  showReorder: { type: Boolean, default: false },
  showRemove: { type: Boolean, default: false },
  checkable: { type: Boolean, default: false },
  checked: { type: Boolean, default: false },
});
const emit = defineEmits(["open", "add", "remove", "move", "toggle"]);

const addFor = ref(null);
const addable = computed(() => {
  const have = new Set((props.workout.programs || []).map((item) => item.programId));
  return props.programs.filter((program) => !have.has(program.programId));
});

function onAdd(event) {
  const programId = Number(event.target.value);
  event.target.value = "";
  addFor.value = null;
  if (programId) emit("add", programId);
}
</script>
