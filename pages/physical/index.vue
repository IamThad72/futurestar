<template>
  <section class="app-page overflow-x-hidden">
    <header class="mb-6 sm:mb-8">
      <h1 class="text-lg font-semibold text-base-content sm:text-xl">
        Physical Health
      </h1>
      <p class="mt-1 text-xs leading-5 text-base-content/60">
        Train and track the body across strength, cardio, mobility, and composition.
        Exercise catalogs are shared; any logs or nutrition you record stay private to you.
      </p>
    </header>

    <div>
      <details class="physical-learn-more group">
        <summary class="training-chip btn btn-primary btn-sm rounded-full w-fit cursor-pointer">
          Learn more
        </summary>
        <div class="mt-5 space-y-5">
          <section v-for="item in sections" :key="item.name">
            <h2 class="!text-xs font-semibold text-gray-900">{{ item.name }}</h2>
            <p class="mt-1 text-xs leading-5 text-gray-600">{{ item.text }}</p>
          </section>
        </div>
      </details>
    </div>
  </section>
</template>

<script setup>
useHead({ title: "Physical Health" });

const sections = [
  {
    name: "Nutrition Journal",
    text: "Set a daily calorie and macro plan, add the foods you eat, then log servings. Each day is compared to your targets so you can see protein, fat, carbohydrate, and calories as you eat.",
  },
  {
    name: "Exercise Journal",
    text: "Start a saved plan or an empty session, then log the sets you did. Past sessions stay on this page. A log copies a plan and leaves the saved plan as you wrote it.",
  },
  {
    name: "Workout Manager",
    text: "Save the plans you repeat. Open a plan to name it, add exercises, and set one target each. Start that plan later from the Exercise Journal.",
  },
];
</script>

<style scoped>
.physical-learn-more > summary {
  list-style: none;
}

.physical-learn-more > summary::-webkit-details-marker {
  display: none;
}
</style>
