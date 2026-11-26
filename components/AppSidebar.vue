<template>
  <component :is="embedded ? 'div' : 'aside'" class="app-sidebar" :class="{ 'app-sidebar--embedded': embedded }" :aria-label="label">
    <nav v-for="group in groups" :key="group.name" class="app-sidebar__group" :aria-label="group.name">
      <p class="app-sidebar__label">{{ group.name }}</p>
      <ul>
        <li v-for="tab in group.tabs" :key="tab.href">
          <AppLink :to="tab.href" :aria-current="tab.current ? 'page' : undefined">
            <AppIcon v-if="tab.icon" :name="tab.icon" :size="20" :filled="tab.current" />
            <span>{{ tab.name }}</span>
          </AppLink>
        </li>
      </ul>
    </nav>
  </component>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  groups: { type: Array, required: true },
  embedded: { type: Boolean, default: false },
});
</script>
