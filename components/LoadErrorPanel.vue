<template>
  <div
    class="rounded-lg border border-error/40 bg-error/10 p-4 text-sm text-error"
    role="alert"
  >
    <p>{{ message }}</p>
    <button
      v-if="showRetry"
      type="button"
      class="btn btn-sm btn-outline mt-2"
      @click="$emit('retry')"
    >
      Retry
    </button>
  </div>
</template>

<script setup>
defineProps({
  message: { type: String, required: true },
  showRetry: { type: Boolean, default: true },
});

defineEmits(["retry"]);
</script>
