<template>
  <div class="relative isolate overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900/50">
    <div v-if="loading" class="px-4 py-10 text-center text-xs text-gray-500 md:text-sm dark:text-gray-400">
      Loading snapshot...
    </div>
    <div v-else class="border-b border-gray-900/10 dark:border-white/10">
      <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="(stat, statIdx) in stats"
          :key="stat.name"
          :class="[
            statIdx % 2 === 1 ? 'sm:border-l' : statIdx === 2 ? 'lg:border-l' : '',
            'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-gray-900/5 px-4 py-6 sm:px-6 md:gap-x-4 md:gap-y-2 md:py-10 lg:border-t-0 dark:border-white/5',
          ]"
        >
          <dt class="text-xs font-medium text-gray-500 md:text-sm dark:text-gray-400">{{ stat.name }}</dt>
          <dd class="w-full flex-none text-xl font-medium tracking-tight text-gray-900 tabular-nums md:text-3xl dark:text-white">
            {{ stat.value }}
          </dd>
        </div>
      </dl>
    </div>
    <div
      class="pointer-events-none absolute left-0 top-full -z-10 mt-96 origin-top-left translate-y-40 -rotate-90 transform-gpu opacity-20 blur-3xl sm:left-1/2 sm:-ml-96 sm:-mt-10 sm:translate-y-0 sm:rotate-0 sm:opacity-50 dark:opacity-10 dark:sm:opacity-30"
      aria-hidden="true"
    >
      <div
        class="aspect-[1154/678] w-[72.125rem] bg-gradient-to-br from-[#FF80B5] to-[#9089FC]"
        style="clip-path: polygon(100% 38.5%, 82.6% 100%, 60.2% 37.7%, 52.4% 32.1%, 47.5% 41.8%, 45.2% 65.6%, 27.5% 23.4%, 0.1% 35.3%, 17.9% 0%, 27.7% 23.4%, 76.2% 2.5%, 74.2% 56%, 100% 38.5%)"
      />
    </div>
  </div>
</template>

<script setup>
defineProps({
  stats: { type: Array, required: true },
  loading: { type: Boolean, default: false },
});
</script>
