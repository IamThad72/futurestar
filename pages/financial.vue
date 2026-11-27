<script setup lang="ts">
import { financialSidebarGroups, financialTabsForPath } from "~/utils/financialNav";

const auth = useAuthStore();

useHead({ title: "Money" });
const { loading: estateLoading, loadError: estateLoadError, estateStats, loadSummary } =
  useEstateSummary();
const {
  loading: budgetChartLoading,
  loadError: chartLoadError,
  expenseChartRows,
  otherChartRows,
  expenseMonth,
  expenseYear,
  otherMonth,
  otherYear,
  monthNames,
  yearOptions,
  loadBudgetChartData,
} = useBudgetChartData();

const dashboardLoadError = computed(() => {
  const parts = [estateLoadError.value, chartLoadError.value].filter(Boolean);
  return parts.join(" ");
});

const monthCloseText = ref("");
const monthCloseError = ref("");

async function loadMonthClose() {
  monthCloseError.value = "";
  if (!auth.user) {
    monthCloseText.value = "";
    return;
  }
  try {
    const data = await $fetch("/api/budget/month-close", {
      query: { year: expenseYear.value, month: expenseMonth.value },
    });
    monthCloseText.value = String(data?.text || "");
  } catch (error) {
    monthCloseText.value = "";
    const failure = settleLoadError(error, "Could not summarize this month.");
    monthCloseError.value = failure.message;
  }
}

const homeGroups = computed(() =>
  financialSidebarGroups(financialTabsForPath("/financial"))
    .map((group) => ({
      name: group.name,
      links: group.tabs
        .map((tab) => ({
          name: tab.name,
          href: tab.href,
          icon: tab.icon,
          description: tab.description,
        })),
    }))
    .filter((group) => group.links.length),
);

function loadDashboard() {
  void loadSummary();
  void loadBudgetChartData();
  void loadMonthClose();
}

onMounted(() => {
  if (!auth.ready) {
    auth.fetchSession();
  }
});

watch(
  () => [auth.ready, auth.user],
  ([ready]) => {
    if (ready) loadDashboard();
  },
  { immediate: true },
);

watch([expenseMonth, expenseYear], () => {
  if (auth.user) void loadMonthClose();
});
</script>

<template>
  <section class="app-page overflow-x-hidden">
    <p v-if="!auth.ready" class="text-sm text-muted">Loading…</p>
    <template v-else>
    <header class="page-header">
      <div class="page-header__copy">
        <h1 class="text-ink">Money</h1>
        <p class="page-header__lede">See where you stand, then open a tool.</p>
      </div>
    </header>

    <header class="mb-4 sm:mb-6">
      <p class="text-sm font-medium text-gray-500 dark:text-gray-400">
        Current snapshot
      </p>
      <p v-if="monthCloseText" class="mt-2 max-w-3xl text-sm leading-6 text-base-content/80">
        {{ monthCloseText }}
        <NuxtLink
          class="ml-1 underline"
          :to="`/cash_flow_tracker?year=${expenseYear}&month=${expenseMonth}`"
        >
          Open the tracker
        </NuxtLink>
      </p>
      <p v-else-if="monthCloseError" class="mt-2 text-sm text-error">{{ monthCloseError }}</p>
    </header>

    <LoadErrorPanel
      v-if="dashboardLoadError"
      class="mb-4"
      :message="dashboardLoadError"
      @retry="loadDashboard"
    />

    <EstateStatsGrid :stats="estateStats" :loading="estateLoading" />

    <ClientOnly>
      <LazyBudgetBarLineChart
        :expense-data="expenseChartRows"
        :other-data="otherChartRows"
        :loading="budgetChartLoading"
        v-model:expense-month="expenseMonth"
        v-model:expense-year="expenseYear"
        v-model:other-month="otherMonth"
        v-model:other-year="otherYear"
        :month-names="monthNames"
        :year-options="yearOptions"
      />
    </ClientOnly>

    <div class="mt-8 space-y-6">
      <section v-for="group in homeGroups" :key="group.name">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">{{ group.name }}</h2>
        <ul class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <li v-for="item in group.links" :key="item.href">
            <AppLink :to="item.href" class="app-card-link app-card-link--financial">
              <span v-if="item.icon" class="app-icon-chip app-icon-chip--lead is-financial" aria-hidden="true">
                <AppIcon :name="item.icon" :size="20" />
              </span>
              <h3 class="text-ink">{{ item.name }}</h3>
              <p class="mt-2 flex-1 text-base leading-6 text-muted">{{ item.description }}</p>
            </AppLink>
          </li>
        </ul>
      </section>
    </div>
    </template>
  </section>
</template>
