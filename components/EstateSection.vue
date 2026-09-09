<template>
  <section>
    <div class="mx-auto max-w-7xl px-1 sm:px-6 lg:px-8">
      <div class="flex flex-wrap items-center justify-between gap-2 md:gap-3">
        <h2 class="text-sm font-semibold text-base-content md:text-base">
          <NuxtLink
            v-if="titleTo"
            :to="titleTo"
            class="hover:text-primary underline-offset-2 hover:underline"
          >
            {{ title }}
          </NuxtLink>
          <template v-else>{{ title }}</template>
        </h2>
        <div class="flex items-center gap-2 md:gap-3">
          <span v-if="total || $slots.total" class="text-xs font-semibold tabular-nums text-base-content md:text-sm">
            <slot name="total">{{ total }}</slot>
          </span>
          <button
            v-if="showAdd"
            type="button"
            class="estate-action-btn"
            @click="$emit('add')"
          >
            <PlusSmallIcon class="-ml-0.5 size-4 md:size-5" aria-hidden="true" />
            {{ addLabel }}
          </button>
        </div>
      </div>
    </div>
    <div
      class="overflow-hidden border-t border-base-300"
      :class="compact ? 'mt-1 pt-2 md:mt-1.5' : 'mt-4 md:mt-6'"
    >
      <div class="mx-auto max-w-7xl px-1 sm:px-6 lg:px-8">
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
  addLabel: { type: String, default: "Add" },
  /** When set, section title links to this route */
  titleTo: { type: String, default: "" },
  /** Tighter gap between heading and content (e.g. Budget Tracker tables) */
  compact: { type: Boolean, default: false },
});

defineEmits(["add"]);
</script>
