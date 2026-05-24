<template>
  <section>
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="flex flex-wrap items-center justify-between gap-2 md:gap-3">
        <h2 class="text-sm font-semibold text-gray-900 md:text-base dark:text-white">{{ title }}</h2>
        <div class="flex items-center gap-2 md:gap-3">
          <span v-if="total || $slots.total" class="text-xs font-semibold tabular-nums text-gray-900 md:text-sm dark:text-white">
            <slot name="total">{{ total }}</slot>
          </span>
          <button
            v-if="showAdd"
            type="button"
            class="estate-action-btn"
            @click="$emit('add')"
          >
            <PlusSmallIcon class="-ml-0.5 size-4 md:size-5" aria-hidden="true" />
            Add
          </button>
        </div>
      </div>
    </div>
    <div
      class="overflow-hidden border-t border-gray-100 dark:border-white/5"
      :class="compact ? 'mt-1 pt-2 md:mt-1.5' : 'mt-4 md:mt-6'"
    >
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <slot />
      </div>
    </div>
  </section>
</template>

<script setup>
import { PlusSmallIcon } from "@heroicons/vue/20/solid";

defineProps({
  title: { type: String, required: true },
  total: { type: String, default: "" },
  showAdd: { type: Boolean, default: true },
  /** Tighter gap between heading and content (e.g. Budget Tracker tables) */
  compact: { type: Boolean, default: false },
});

defineEmits(["add"]);
</script>
