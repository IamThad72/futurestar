<template>
  <SectionTabsNav
    v-if="tabs.length"
    :tabs="tabs"
    fallback-href="/physical"
    aria-label="Physical"
  />
</template>

<script setup>
import { physicalTabsForPath } from "~/utils/physicalNav";

const route = useRoute();
const tabs = computed(() => physicalTabsForPath(route.path));
</script>
