<template>
  <section v-if="prayers.length" class="app-card min-w-0 max-w-full px-4 py-4">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-sm font-semibold text-gray-900">{{ title }}</h2>
      <AppLink to="/spiritual/prayers" class="text-xs font-medium text-primary underline-offset-2 hover:underline">
        Prayer list<span v-if="activeCount > prayers.length"> ({{ activeCount }})</span>
      </AppLink>
    </div>
    <ul class="mt-3 space-y-2">
      <li v-for="prayer in prayers" :key="prayer.prayer_id" class="min-w-0">
        <p class="break-words text-base text-gray-900">{{ prayer.title }}</p>
        <p v-if="prayer.person || prayer.category" class="text-sm text-muted">
          {{ [prayer.person, prayer.category].filter(Boolean).join(" · ") }}
        </p>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { todayIsoDate } from "~/utils/liturgicalCalendar";

/** A few open prayer requests, rotating by day. Hidden when the list is empty or not set up. */
const props = defineProps({
  title: { type: String, default: "Carry in prayer" },
  date: { type: String, default: "" },
  count: { type: Number, default: 3 },
});

const prayers = ref([]);
const activeCount = ref(0);

async function load() {
  try {
    const data = await $fetch("/api/spiritual/prayers", {
      query: { view: "today", count: props.count, date: props.date || todayIsoDate() },
    });
    prayers.value = data?.unavailable ? [] : data?.prayers || [];
    activeCount.value = Number(data?.counts?.active || 0);
  } catch {
    prayers.value = [];
  }
}

watch(() => props.date, load);
onMounted(load);
</script>
