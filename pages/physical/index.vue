<template>
  <section class="app-page overflow-x-hidden">
    <header class="page-header">
      <div class="page-header__copy">
        <h1 class="text-ink">Body</h1>
        <p class="page-header__lede">Log meals, record workouts, and save plans you can start again.</p>
      </div>
    </header>
    <div class="mb-6 sm:mb-8">
      <div v-if="todayText || todayError" class="mt-4 max-w-xl">
        <p v-if="todayError" class="text-sm text-error">{{ todayError }}</p>
        <p v-else class="text-base leading-6 text-ink">{{ todayText }}</p>
        <p v-if="todayDetail" class="mt-1 text-xs text-base-content/60">{{ todayDetail }}</p>
      </div>
    </div>

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

useHead({ title: "Body" });

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
    const failure = settleLoadError(error, "Could not load today.");
    if (failure.auth) return;
    todayError.value = failure.message;
  }
});
</script>
