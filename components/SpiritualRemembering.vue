<template>
  <section class="app-card px-4 py-4">
    <h2 class="text-sm font-semibold text-gray-900">Remember</h2>
    <p class="mt-1 text-sm text-gray-700">
      Hold these before you begin the work of the day.
    </p>
    <ul class="mt-4 space-y-3">
      <li
        v-for="truth in truths"
        :key="truth"
        class="rounded-md bg-gray-50 px-3 py-2 text-sm leading-6 text-gray-900"
      >
        {{ truth }}
      </li>
    </ul>
  </section>
</template>

<script setup>
import { REMEMBER_TRUTHS } from "~/utils/spiritualReview";

const truths = REMEMBER_TRUTHS;
</script>
