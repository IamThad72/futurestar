<template>
  <div v-if="category" class="space-y-4">
    <header class="space-y-2">
      <AppLink
        to="/physical/workouts"
        class="inline-flex text-sm font-medium text-primary no-underline hover:text-primary/80"
      >
        ← Training lists
      </AppLink>
      <div>
        <h2 class="text-base font-semibold text-base-content">{{ category.name }}</h2>
        <p class="mt-1 text-sm text-base-content/60">
          {{ category.description }}
          Tap Add to put an exercise on your workout.
        </p>
      </div>
    </header>

    <StrengthExerciseList v-if="category.slug === 'strength-training'" />
    <EnduranceExerciseList v-else-if="category.slug === 'cardio-training'" kind="cardio" />
    <EnduranceExerciseList v-else-if="category.slug === 'aerobic-training'" kind="aerobic" />
    <FlexibilityExerciseList v-else-if="category.slug === 'stretching'" kind="stretch" />
    <FlexibilityExerciseList v-else-if="category.slug === 'yoga-training'" kind="yoga" />
    <FlexibilityExerciseList v-else-if="category.slug === 'plyometrics-training'" kind="plyo" />
  </div>
</template>

<script setup>
import { canonicalPhysicalSlug, physicalTrainingBySlug } from "~/utils/physicalNav";

const route = useRoute();
const category = computed(() => physicalTrainingBySlug(String(route.params.slug || "")));

watch(
  () => String(route.params.slug || ""),
  (slug) => {
    const canonical = canonicalPhysicalSlug(slug);
    if (!physicalTrainingBySlug(canonical)) {
      void navigateTo("/physical/workouts", { replace: true });
      return;
    }
    if (canonical !== slug) {
      void navigateTo(`/physical/workouts/${canonical}`, { replace: true });
    }
  },
  { immediate: true },
);

useHead(() => ({
  title: category.value ? `${category.value.name} · Workout Manager` : "Workout Manager",
}));
</script>
