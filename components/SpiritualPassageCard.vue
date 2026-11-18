<template>
  <blockquote class="space-y-2">
    <p class="sl-scripture whitespace-pre-line">
      “{{ passage.text }}”
    </p>
    <footer class="text-xs text-gray-700">
      — {{ passage.citation }}
      <span v-if="attribution"> · {{ attribution }}</span>
    </footer>
  </blockquote>
</template>

<script setup>
defineProps({
  passage: { type: Object, required: true },
  attribution: { type: String, default: "" },
});
</script>
