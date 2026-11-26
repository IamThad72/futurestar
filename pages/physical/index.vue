<template>
  <section class="app-page overflow-x-hidden">
    <header class="mb-6 sm:mb-8">
      <h1 class="text-ink">
        Physical Health
      </h1>
      <p class="mt-2 text-base leading-6 text-muted">
        Train and track the body across strength, cardio, mobility, and composition.
        Exercise catalogs are shared; any logs or nutrition you record stay private to you.
      </p>
      <div v-if="todayText || todayError" class="mt-4 max-w-xl">
        <p v-if="todayError" class="text-sm text-error">{{ todayError }}</p>
        <p v-else class="text-base leading-6 text-ink">{{ todayText }}</p>
        <p v-if="todayDetail" class="mt-1 text-xs text-base-content/60">{{ todayDetail }}</p>
      </div>
    </header>

    <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <li v-for="item in homeLinks" :key="item.href">
        <AppLink :to="item.href" class="app-card-link app-card-link--physical">
          <span v-if="item.icon" class="app-icon-chip app-icon-chip--lead is-physical" aria-hidden="true">
            <AppIcon :name="item.icon" :size="20" />
          </span>
          <h2 class="text-ink">{{ item.name }}</h2>
          <p class="mt-2 flex-1 text-base leading-6 text-muted">{{ item.description }}</p>
        </AppLink>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { PHYSICAL_HOME_LINKS } from "~/utils/physicalNav";

useHead({ title: "Physical Health" });

const homeLinks = PHYSICAL_HOME_LINKS;

const todayText = ref("");
const todayDetail = ref("");
const todayError = ref("");

onMounted(async () => {
  try {
    const data = await $fetch("/api/physical/today");
    todayText.value = String(data?.text || "");
    const bits = [];
    if (data?.kcalConsumed != null && data?.kcalRemaining != null) {
      bits.push(`${data.kcalConsumed} kcal eaten, ${data.kcalRemaining} kcal left`);
    }
    if (data?.proteinConsumed != null && data?.proteinRemaining != null) {
      bits.push(`${data.proteinConsumed} g protein eaten, ${data.proteinRemaining} g left`);
    }
    todayDetail.value = bits.join(" · ");
  } catch (error) {
    const status = error?.statusCode || error?.status;
    if (status === 401) return;
    todayError.value = error?.data?.statusMessage || error?.statusMessage || "Could not load today.";
  }
});
</script>
