<template>
  <article class="app-card flex flex-col gap-3 p-3 sm:flex-row sm:gap-3 sm:px-4 sm:py-3">
    <div class="flex min-w-0 flex-1 flex-col gap-2">
      <div
        class="flex min-w-0 gap-3 rounded-md"
        :class="{
          'cursor-grab': allowDrag && canAdd,
          'cursor-not-allowed opacity-40': !canAdd,
        }"
        :draggable="allowDrag && canAdd"
        :aria-label="dragLabel"
        @dragstart="onDragStart"
        @dragend="onDragEnd"
      >
        <span
          v-if="allowDrag"
          class="inline-flex w-10 shrink-0 items-center justify-center self-stretch rounded-md text-base-content/40 hover:bg-base-200 hover:text-base-content/70 sm:w-12"
          aria-hidden="true"
        >
          <Bars2Icon class="size-6" />
        </span>
        <div class="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 class="text-base font-semibold text-base-content">{{ exercise.name }}</h3>
            <p class="text-sm font-medium tabular-nums text-primary">
              {{ exercise.sets }} × {{ exercise.repetitions }}
            </p>
            <p v-if="exercise.rest" class="text-xs text-base-content/60">Rest {{ exercise.rest }}</p>
          </div>

          <p class="text-sm text-base-content/70">{{ exercise.description }}</p>

          <div v-if="muscleTags.length" class="flex flex-wrap gap-1">
            <span
              v-for="tag in muscleTags"
              :key="tag"
              class="training-chip rounded-full bg-base-200 px-3.5 py-0.5 text-[11px] text-base-content/70"
            >
              {{ tag }}
            </span>
          </div>
        </div>
      </div>

      <div
        class="flex flex-wrap items-center gap-x-3 gap-y-2"
        :class="allowDrag ? 'pl-10 sm:pl-[3.75rem]' : ''"
      >
        <button
          type="button"
          class="self-start text-sm font-medium text-primary no-underline hover:text-primary/80"
          @click="expanded = !expanded"
        >
          {{ expanded ? "Hide details" : "Show instructions" }}
        </button>
        <button
          type="button"
          class="training-chip btn btn-primary btn-sm rounded-full"
          :disabled="!canAdd"
          @click.stop="addToWorkout"
        >
          {{ justAdded ? "Added" : "Add to workout" }}
        </button>
        <span v-if="inWorkoutCount" class="text-xs text-base-content/60">
          In workout ×{{ inWorkoutCount }}
        </span>
      </div>

      <dl v-if="expanded" class="grid gap-3 sm:grid-cols-2" :class="allowDrag ? 'pl-10 sm:pl-[3.75rem]' : ''">
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-base-content/50">
            Instructions
          </dt>
          <dd class="mt-1">
            <ol class="list-decimal space-y-0.5 pl-4 text-sm text-base-content/80">
              <li v-for="(step, index) in exercise.instructions" :key="index">{{ step }}</li>
            </ol>
          </dd>
        </div>
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-base-content/50">
            Benefits
          </dt>
          <dd class="mt-1">
            <ul class="list-disc space-y-0.5 pl-4 text-sm text-base-content/80">
              <li v-for="benefit in exercise.benefits" :key="benefit">{{ benefit }}</li>
            </ul>
          </dd>
        </div>
      </dl>
    </div>

    <div
      class="mx-auto h-24 w-24 shrink-0 overflow-hidden rounded-md bg-base-200 sm:mx-0 sm:h-[114px] sm:w-[114px]"
      :class="{
        'cursor-grab': allowDrag && !gifSrc && canAdd,
        'cursor-not-allowed opacity-40': !gifSrc && !canAdd,
      }"
      :draggable="allowDrag && !gifSrc && canAdd"
      :aria-hidden="Boolean(gifSrc)"
      :aria-label="allowDrag && !gifSrc && canAdd ? `Drag ${exercise.name} to workout` : undefined"
      @dragstart="onEmptySlotDragStart"
      @dragend="onDragEnd"
    >
      <button
        v-if="gifSrc"
        type="button"
        class="h-full w-full cursor-zoom-in border-0 bg-transparent p-0"
        :aria-label="`View larger image of ${exercise.name}`"
        @click="openPreview"
      >
        <img
          :src="gifSrc"
          alt=""
          draggable="false"
          referrerpolicy="no-referrer"
          class="h-full w-full object-contain"
          loading="lazy"
          @error="gifFailed = true"
        />
      </button>
    </div>

    <dialog ref="previewRef" class="modal">
      <div class="modal-box w-[calc(100%-2rem)] max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:w-full">
        <h3 class="text-lg font-semibold text-base-content">{{ exercise.name }}</h3>
          <img
            v-if="gifSrc"
            :src="gifSrc"
            alt=""
            draggable="false"
            referrerpolicy="no-referrer"
            class="mt-3 mx-auto max-h-[70vh] w-full object-contain"
          />
        <div class="modal-action mt-4">
          <form method="dialog">
            <button type="submit" class="btn btn-ghost btn-sm min-h-9">Close</button>
          </form>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
  </article>
</template>

<script setup>
import { Bars2Icon } from "@heroicons/vue/24/outline";
import { catalogExerciseId, payloadFromExercise, WORKOUT_EXERCISE_DND } from "~/utils/workoutDraft";

const props = defineProps({
  exercise: { type: Object, required: true },
});

const expanded = ref(false);
const gifFailed = ref(false);
const justAdded = ref(false);
const previewRef = ref(null);
let justAddedTimer;
const { addExercise, beginCatalogDrag, endCatalogDrag, draft } = useWorkoutDraft();
const { preferTapAdd } = useMobileShell();

const canAdd = computed(() => Boolean(catalogExerciseId(props.exercise)));
const allowDrag = computed(() => canAdd.value && !preferTapAdd.value);
const dragLabel = computed(() => {
  if (!canAdd.value) return `${props.exercise.name} is not in the catalog`;
  if (!allowDrag.value) return undefined;
  return `Drag ${props.exercise.name} to workout`;
});
const inWorkoutCount = computed(() => {
  const id = catalogExerciseId(props.exercise);
  if (!id) return 0;
  return draft.value.exercises.filter((item) => item.exerciseId === id).length;
});

function openPreview() {
  if (!gifSrc.value) return;
  previewRef.value?.showModal?.();
}

function addToWorkout() {
  if (!addExercise(props.exercise)) return;
  justAdded.value = true;
  clearTimeout(justAddedTimer);
  justAddedTimer = setTimeout(() => {
    justAdded.value = false;
  }, 1500);
}

function onDragStart(event) {
  if (!allowDrag.value) {
    event.preventDefault();
    return;
  }
  event.stopPropagation();
  const payload = payloadFromExercise(props.exercise);
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData(WORKOUT_EXERCISE_DND, JSON.stringify(payload));
  event.dataTransfer.setData("text/plain", JSON.stringify(payload));
  beginCatalogDrag();
}

function onEmptySlotDragStart(event) {
  if (gifSrc.value || !allowDrag.value) {
    event.preventDefault();
    return;
  }
  onDragStart(event);
}

function onDragEnd() {
  endCatalogDrag();
}

const gifSrc = computed(() => {
  if (gifFailed.value) return "";
  return props.exercise.gifUrl || "";
});

watch(
  () => props.exercise.gifUrl,
  () => {
    gifFailed.value = false;
  },
);

onUnmounted(() => {
  clearTimeout(justAddedTimer);
});

const muscleTags = computed(() => {
  const primary = props.exercise.targetMuscles || [];
  const secondary = props.exercise.secondaryMuscles || [];
  return [...primary, ...secondary].filter(Boolean);
});
</script>
