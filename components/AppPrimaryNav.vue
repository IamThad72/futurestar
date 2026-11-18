<template>
  <nav class="app-primary-nav" aria-label="Areas of life">
    <AppLink
      v-for="link in links"
      :key="link.path"
      :to="link.path"
      class="app-primary-nav__link"
      :data-pillar="link.pillar || undefined"
      :aria-current="link.current ? 'page' : undefined"
    >
      <span class="app-primary-nav__icon" :class="link.pillar ? `is-${link.pillar}` : 'is-neutral'">
        <AppIcon :name="link.icon" :size="24" :stroke-width="1.75" />
      </span>
      <span>{{ link.name }}</span>
    </AppLink>
  </nav>
</template>

<script setup>
defineProps({
  links: { type: Array, required: true },
});
</script>
