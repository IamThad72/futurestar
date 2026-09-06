<template>
  <section
    class="workout-manager app-page-wide"
    :class="{ 'workout-manager--picking': picking }"
  >
    <header class="mb-4 sm:mb-6">
      <h1 class="text-lg font-semibold text-base-content sm:text-xl">Workout Manager</h1>
      <p class="mt-1 text-sm text-base-content/60">
        {{ introText }}
      </p>
    </header>

    <div class="workout-manager__shell">
      <div class="workout-manager__main">
        <WorkoutBuilderPanel />
      </div>
      <aside class="workout-manager__dock">
        <NuxtPage />
      </aside>
    </div>
  </section>
</template>

<script setup>
useHead({ title: "Workout Manager" });

const route = useRoute();
const { preferTapAdd } = useMobileShell();

const browsingCatalog = computed(() => /^\/physical\/workouts\/[^/]+/.test(route.path));
const picking = computed(() => preferTapAdd.value && browsingCatalog.value);
const introText = computed(() =>
  preferTapAdd.value
    ? "Name a workout, open a training list, then tap Add on each exercise."
    : "Name a workout, open a training list, then tap Add — or drag exercises onto the workout.",
);
</script>

<style scoped>
.workout-manager__shell {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.workout-manager--picking {
  padding-bottom: 5.5rem;
}

.workout-manager--picking .workout-manager__dock {
  order: -1;
}

@media (min-width: 1024px) {
  .workout-manager__shell {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    align-items: start;
    gap: 1.5rem;
  }

  .workout-manager__main {
    position: sticky;
    top: 1rem;
    min-width: 0;
  }

  .workout-manager__dock {
    min-width: 0;
    order: 0;
  }

  .workout-manager--picking {
    padding-bottom: 0;
  }
}
</style>
