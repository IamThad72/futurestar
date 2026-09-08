<template>
  <SectionTabsNav
    v-if="tabs.length"
    :tabs="tabs"
    :embedded="embedded"
    fallback-href="/physical"
    aria-label="Physical"
  />
</template>

<script setup>
import { physicalTabsForPath } from "~/utils/physicalNav";

defineProps({
  embedded: { type: Boolean, default: false },
});

const route = useRoute();
const tabs = computed(() => physicalTabsForPath(route.path));
</script>
