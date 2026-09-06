<template>
  <section class="app-page">
    <header class="mb-6">
      <h1 class="text-lg font-semibold text-base-content sm:text-xl">{{ title }}</h1>
      <p class="mt-1 text-sm text-base-content/60">{{ description }}</p>
    </header>
    <p class="app-card px-4 py-8 text-sm text-base-content/70">
      This section is coming soon.
    </p>
  </section>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
});
</script>
