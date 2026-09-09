<template>
  <SectionTabsNav
    v-if="tabs.length"
    :tabs="tabs"
    :embedded="embedded"
    fallback-href="/spiritual"
    aria-label="Spiritual"
  />
</template>

<script setup>
import { spiritualTabsForPath } from "~/utils/spiritualNav";

defineProps({
  embedded: { type: Boolean, default: false },
});

const route = useRoute();
const tabs = computed(() => spiritualTabsForPath(route.path));
</script>
