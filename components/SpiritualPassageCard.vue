<template>
  <blockquote class="space-y-2">
    <p class="whitespace-pre-line text-sm leading-6 text-gray-800 dark:text-gray-100">
      “{{ passage.text }}”
    </p>
    <footer class="text-xs text-gray-500 dark:text-gray-400">
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
