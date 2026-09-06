<template>
  <SectionTabsNav
    v-if="tabs.length"
    :tabs="tabs"
    fallback-href="/financial"
    aria-label="Financial"
  />
</template>

<script setup>
import { financialTabsForPath } from "~/utils/financialNav";

const route = useRoute();
const tabs = computed(() => financialTabsForPath(route.path, route.query, route.hash));
</script>
