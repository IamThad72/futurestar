<template>
  <section v-if="section" class="app-page">
    <header class="mb-6">
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-lg font-semibold text-base-content sm:text-xl">{{ section.name }}</h1>
        <button
          v-if="section.slug === 'nutrition'"
          type="button"
          class="training-chip nutrition-add-inventory-btn btn btn-primary btn-sm rounded-full"
          aria-label="Add Food Inventory"
          @click="openAddFood"
        >
          <PlusSmallIcon class="size-5 shrink-0" aria-hidden="true" />
          <span>Food Inventory</span>
        </button>
        <button
          v-else-if="section.slug === 'workout-journal'"
          type="button"
          class="training-chip journal-history-btn btn btn-primary btn-sm rounded-full"
          aria-label="History"
          @click="openHistory"
        >
          <ClockIcon class="size-5 shrink-0" aria-hidden="true" />
          <span>History</span>
        </button>
      </div>
      <div v-if="section.slug === 'nutrition'" class="mt-2 flex flex-wrap items-center gap-2">
        <span class="text-lg font-bold text-base-content">{{ currentPlanName || "No daily plan" }}</span>
        <button
          type="button"
          class="training-chip nutrition-plan-edit-btn btn btn-primary btn-xs rounded-full"
          @click="openPlan"
        >
          Edit
        </button>
      </div>
    </header>
    <NutritionTracker
      v-if="section.slug === 'nutrition'"
      ref="nutritionTracker"
      @plan-change="onPlanChange"
    />
    <WorkoutExerciseJournal
      v-else-if="section.slug === 'workout-journal'"
      ref="exerciseJournal"
    />
  </section>
</template>

<script setup>
import { ClockIcon, PlusSmallIcon } from "@heroicons/vue/20/solid";
import WorkoutExerciseJournal from "~/components/WorkoutExerciseJournal.vue";
import {
  canonicalPhysicalSlug,
  physicalCategoryBySlug,
  physicalTrainingBySlug,
} from "~/utils/physicalNav";

const route = useRoute();
const nutritionTracker = ref(null);
const exerciseJournal = ref(null);
const currentPlanName = ref("");

function openAddFood() {
  nutritionTracker.value?.openAddFoodModal();
}

function openPlan() {
  nutritionTracker.value?.openPlanModal();
}

function openHistory() {
  exerciseJournal.value?.openHistoryModal();
}

function onPlanChange(name) {
  currentPlanName.value = String(name || "");
}
const slug = computed(() => canonicalPhysicalSlug(String(route.params.slug || "")));
const section = computed(() => {
  const found = physicalCategoryBySlug(slug.value);
  if (!found) return null;
  if (found.slug === "nutrition" || found.slug === "workout-journal") return found;
  return null;
});

watch(
  () => String(route.params.slug || ""),
  (raw) => {
    const canonical = canonicalPhysicalSlug(raw);
    if (physicalTrainingBySlug(canonical) || canonical === "workouts") {
      const href =
        canonical === "workouts" ? "/physical/workouts" : `/physical/workouts/${canonical}`;
      void navigateTo(href, { replace: true });
      return;
    }
    if (canonical !== "nutrition" && canonical !== "workout-journal") {
      void navigateTo("/physical", { replace: true });
      return;
    }
    if (canonical !== raw) {
      void navigateTo(`/physical/${canonical}`, { replace: true });
    }
  },
  { immediate: true },
);

useHead(() => ({
  title: section.value?.name || "Physical Health",
}));
</script>
