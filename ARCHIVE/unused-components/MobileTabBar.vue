<template>
  <nav class="mobile-tab-bar" aria-label="Main">
    <AppLink
      v-for="tab in tabs"
      :key="tab.path"
      :to="tab.path"
      class="mobile-tab-bar__item"
      :class="{ 'mobile-tab-bar__item--active': isSelected(tab.path) }"
    >
      <ion-icon :icon="tab.icon" aria-hidden="true" />
      <span>{{ tab.label }}</span>
    </AppLink>
  </nav>
</template>

<script setup>
import {
  homeOutline,
  walletOutline,
  barChartOutline,
  personCircleOutline,
} from "ionicons/icons";

const route = useRoute();

const tabs = [
  { path: "/estate_mgmt", label: "Estate", icon: homeOutline },
  { path: "/cash_flow_mgmt", label: "Budget", icon: walletOutline },
  { path: "/cash_flow_tracker", label: "Tracker", icon: barChartOutline },
  { path: "/account", label: "Account", icon: personCircleOutline },
];

function isSelected(path) {
  return route.path === path || route.path.startsWith(`${path}/`);
}
</script>

<style scoped>
.mobile-tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  display: flex;
  height: calc(3.25rem + env(safe-area-inset-bottom, 0));
  padding-bottom: env(safe-area-inset-bottom, 0);
  background: var(--color-base-100, #fbffff);
  border-top: 1px solid var(--color-base-300, #babebe);
}

.mobile-tab-bar__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  min-width: 0;
  padding: 0.35rem 0.25rem 0;
  font-size: 0.65rem;
  font-weight: 500;
  color: var(--color-base-content, #151616);
  opacity: 0.55;
  text-decoration: none;
}

.mobile-tab-bar__item ion-icon {
  font-size: 1.35rem;
}

.mobile-tab-bar__item--active {
  color: var(--color-primary, #1e3a8a);
  opacity: 1;
}
</style>
