<template>
  <section v-if="section" class="app-page">
    <header class="mb-6">
      <h1 class="text-lg font-semibold text-base-content sm:text-xl">{{ section.name }}</h1>
      <p class="mt-1 text-sm text-base-content/60">{{ section.description }}</p>
    </header>
    <div
      v-if="!auth.ready"
      class="app-card px-4 py-6 text-sm text-base-content/60"
    >
      Loading session...
    </div>
    <div
      v-else-if="!auth.user"
      class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      You must be logged in to use Spiritual Health.
    </div>
    <template v-else>
      <SpiritualMorningPrayer v-if="section.slug === 'morning'" />
      <SpiritualRemembering v-else-if="section.slug === 'remembering'" />
      <SpiritualScripture v-else-if="section.slug === 'scripture'" />
      <SpiritualEveningExamen v-else-if="section.slug === 'examen'" />
    </template>
  </section>
</template>

<script setup>
import { spiritualSectionBySlug } from "~/utils/spiritualNav";

const auth = useAuthStore();
const route = useRoute();
const slug = computed(() => String(route.params.slug || ""));
const section = computed(() => spiritualSectionBySlug(slug.value));

watch(
  slug,
  (value) => {
    if (!spiritualSectionBySlug(value)) {
      void navigateTo("/spiritual", { replace: true });
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (!auth.ready) {
    auth.fetchSession();
  }
});

useHead(() => ({
  title: section.value?.name || "Spiritual Health",
}));
</script>
