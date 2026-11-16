<template>
  <aside class="app-sidebar" :aria-label="label">
    <nav v-for="group in groups" :key="group.name" class="app-sidebar__group" :aria-label="group.name">
      <p class="app-sidebar__label">{{ group.name }}</p>
      <ul>
        <li v-for="tab in group.tabs" :key="tab.href">
          <AppLink :to="tab.href" :aria-current="tab.current ? 'page' : undefined">
            {{ tab.name }}
          </AppLink>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  groups: { type: Array, required: true },
});
</script>
