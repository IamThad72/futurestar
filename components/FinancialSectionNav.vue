<template>
  <SectionTabsNav
    v-if="tabs.length"
    :tabs="tabs"
    :embedded="embedded"
    fallback-href="/financial"
    aria-label="Financial"
  />
</template>

<script setup>
import { financialTabsForPath } from "~/utils/financialNav";

defineProps({
  embedded: { type: Boolean, default: false },
});

const route = useRoute();
const tabs = computed(() => financialTabsForPath(route.path, route.query, route.hash));
</script>
