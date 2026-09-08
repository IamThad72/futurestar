<template>
  <div class="space-y-4">
    <header>
      <h2 class="text-base font-semibold text-base-content">Training lists</h2>
      <p class="mt-1 text-sm text-base-content/60">
        Expand a list, then tap Add on each exercise you want in the workout.
        <template v-if="!preferTapAdd"> You can also drag a card onto the workout.</template>
      </p>
    </header>

    <TrainingListsAccordion />
  </div>
</template>

<script setup>
const { preferTapAdd } = useMobileShell();
</script>
