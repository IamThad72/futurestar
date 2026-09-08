<template>
  <ion-accordion-group ref="groupRef" class="training-accordion">
    <ion-accordion v-for="item in categories" :key="item.slug" :value="item.slug">
      <button
        type="button"
        slot="header"
        class="training-accordion__header"
        :class="{ 'training-accordion__header--open': openSlug === item.slug }"
        :aria-expanded="openSlug === item.slug"
      >
        <span class="min-w-0 flex-1 text-left">
          <span class="training-accordion__title block text-sm font-semibold">{{ item.name }}</span>
          <span class="mt-0.5 block text-xs text-base-content/60">{{ item.description }}</span>
        </span>
        <ChevronDownIcon
          class="training-accordion__chevron size-5"
          :class="{ 'training-accordion__chevron--open': openSlug === item.slug }"
          aria-hidden="true"
        />
      </button>
      <div class="training-accordion__content" slot="content">
        <TrainingCategoryList v-if="opened.has(item.slug)" :slug="item.slug" />
      </div>
    </ion-accordion>
  </ion-accordion-group>
</template>

<script setup>
import { ChevronDownIcon } from "@heroicons/vue/24/outline";
import { IonAccordion, IonAccordionGroup } from "@ionic/vue";
import { CATALOG_PICKER_KEY } from "~/utils/workoutDraft";
import { PHYSICAL_CATEGORIES } from "~/utils/physicalNav";

const props = defineProps({
  addExercise: { type: Function, default: null },
  addedExercises: { type: Array, default: null },
});

provide(CATALOG_PICKER_KEY, {
  add: props.addExercise,
  exercises: computed(() => props.addedExercises),
  allowDrag: !props.addExercise,
});

const categories = PHYSICAL_CATEGORIES;
const groupRef = ref(null);
const openSlug = ref("");
const opened = ref(new Set());

function groupEl() {
  const el = groupRef.value;
  return el?.$el ?? el ?? null;
}

function onAccordionChange(event) {
  const value = String(event?.detail?.value || "");
  openSlug.value = value;
  if (!value || opened.value.has(value)) return;
  const next = new Set(opened.value);
  next.add(value);
  opened.value = next;
}

onMounted(() => {
  groupEl()?.addEventListener("ionChange", onAccordionChange);
});

onBeforeUnmount(() => {
  groupEl()?.removeEventListener("ionChange", onAccordionChange);
});
</script>

<style scoped>
.training-accordion {
  border: 1px solid var(--color-base-300, #babebe);
  border-radius: 0.75rem;
  overflow: hidden;
  background: var(--color-base-100, #fff);
}

.training-accordion :deep(.ion-accordion-toggle-icon) {
  display: none;
}

.training-accordion ion-accordion:not(:last-child) {
  border-bottom: 1px solid color-mix(in srgb, var(--color-base-content, #1a1a1a) 50%, transparent);
}

.training-accordion__header {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.75rem;
  min-height: 3.75rem;
  padding: 0.75rem 1rem;
  text-align: left;
  background: var(--color-base-100, #fff);
  color: inherit;
}

.training-accordion__title {
  color: var(--color-base-content, #1a1a1a);
}

.training-accordion__header--open .training-accordion__title,
.training-accordion :deep(ion-accordion.accordion-expanded) .training-accordion__title {
  color: var(--color-primary, #06b6d4);
}

.training-accordion__chevron {
  flex-shrink: 0;
  color: var(--color-primary, #06b6d4);
  transition: transform 0.2s ease;
}

.training-accordion__chevron--open {
  transform: rotate(180deg);
}

.training-accordion__content {
  padding: 0.75rem 1rem 1.25rem;
  background: var(--color-base-100, #fff);
}
</style>
