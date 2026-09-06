<template>
  <div class="space-y-4">
    <header>
        <h2 class="text-base font-semibold text-base-content">Training lists</h2>
      <p class="mt-1 text-sm text-base-content/60">
        Open a list, then tap Add on each exercise you want in the workout.
      </p>
    </header>

    <ul class="grid grid-cols-1 gap-3">
      <li v-for="item in trainingLinks" :key="item.href">
        <AppLink
          :to="item.href"
          class="app-card-link px-4 py-4"
        >
          <h3 class="text-sm font-semibold text-base-content">{{ item.name }}</h3>
          <p class="mt-1 text-sm text-base-content/60">{{ item.description }}</p>
        </AppLink>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { PHYSICAL_TRAINING_LINKS } from "~/utils/physicalNav";

const trainingLinks = PHYSICAL_TRAINING_LINKS;
</script>
