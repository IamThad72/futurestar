<template>
  <section v-if="section" class="app-page">
    <header v-if="section.slug !== 'nutrition'" class="app-sticky-action mb-6">
      <h1 class="text-lg font-semibold text-base-content sm:text-xl">{{ section.name }}</h1>
    </header>
    <header v-else-if="!useMobileChrome" class="mb-4">
      <h1 class="text-lg font-semibold text-base-content sm:text-xl">{{ section.name }}</h1>
    </header>
    <NutritionTracker v-if="section.slug === 'nutrition'" />
    <WorkoutExerciseJournal v-else-if="section.slug === 'workout-journal'" />
  </section>
</template>

<script setup>
import WorkoutExerciseJournal from "~/components/WorkoutExerciseJournal.vue";
import {
  canonicalPhysicalSlug,
  physicalCategoryBySlug,
  physicalTrainingBySlug,
} from "~/utils/physicalNav";

const route = useRoute();
const { useMobileChrome } = useMobileShell();
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
      void navigateTo("/physical/workouts", { replace: true });
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
