<template>
  <div class="empty-state">
    <p class="empty-state__title">{{ title }}</p>
    <p class="empty-state__sentence">{{ sentence }}</p>
    <NuxtLink v-if="to" :to="to" class="btn btn-primary">{{ action }}</NuxtLink>
    <button v-else-if="action" type="button" class="btn btn-primary" @click="$emit('action')">
      {{ action }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  sentence: { type: String, required: true },
  action: { type: String, default: "" },
  to: { type: String, default: "" },
});

defineEmits(["action"]);
</script>

<style scoped>
.empty-state {
  display: flex;
  max-width: 36rem;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.5rem 0 1rem;
}

.empty-state__title {
  margin: 0;
  font-family: "Fraunces Variable", ui-serif, Georgia, serif;
  font-size: 22px;
  font-weight: 560;
  line-height: 28px;
  letter-spacing: -0.015em;
  color: var(--sl-ink, #1c2430);
}

.empty-state__sentence {
  margin: 0;
  font-size: 1rem;
  line-height: 1.5rem;
  color: var(--sl-muted, #5e5a52);
}
</style>
