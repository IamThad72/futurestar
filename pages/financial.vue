<script setup lang="ts">
import { financialSidebarGroups, financialTabsForPath } from "~/utils/financialNav";

const auth = useAuthStore();

useHead({ title: "Financial Health" });
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
  try {
    const data = await $fetch("/api/budget/month-close", {
      query: { year: expenseYear.value, month: expenseMonth.value },
    });
    monthCloseText.value = String(data?.text || "");
  } catch (error) {
    monthCloseText.value = "";
    monthCloseError.value = error?.data?.statusMessage || error?.statusMessage || "Could not summarize this month.";
  }
}

const { isStacked } = useMobileShell();
const homeGroups = computed(() =>
  financialSidebarGroups(financialTabsForPath("/financial"))
    .map((group) => ({
      name: group.name,
      links: group.tabs
        .filter((tab) => (isStacked.value ? !tab.hideOnMobile : true))
        .map((tab) => ({
          name: tab.name,
          href: tab.href,
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
  if (auth.user) {
    loadDashboard();
  }
});

watch(
  () => auth.user,
  (user) => {
    if (user) loadDashboard();
  },
);

watch([expenseMonth, expenseYear], () => {
  if (auth.user) void loadMonthClose();
});
</script>

<template>
  <div v-if="!auth.ready" class="app-page">
    <p class="text-sm text-base-content/60">Loading session...</p>
  </div>

  <div
    v-else-if="!auth.user"
    class="app-page rounded-lg border border-warning/30 bg-warning/10 text-base text-base-content"
  >
    You must be logged in to use Financial Home.
  </div>

  <section v-else class="app-page overflow-x-hidden">
    <header class="mb-6 sm:mb-8">
      <h1 class="text-ink">
        Financial Health
      </h1>
      <p class="mt-2 text-base leading-6 text-muted">
        Steward cash, accounts, and tax in one place. The snapshot is the current picture.
        Open a tool under it.
      </p>
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
        <h2 class="text-xs font-semibold uppercase tracking-wide text-base-content/50">{{ group.name }}</h2>
        <ul class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <li v-for="item in group.links" :key="item.href">
            <AppLink :to="item.href" class="app-card-link">
              <h3 class="text-ink">{{ item.name }}</h3>
              <p class="mt-2 flex-1 text-base leading-6 text-muted">{{ item.description }}</p>
            </AppLink>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
