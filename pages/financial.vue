<script setup lang="ts">
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

const sections = [
  {
    name: "Estate Management",
    text: "Track assets, debts, insurance, and net worth in one place so you can see what you own, what you owe, and how the household balance sheet changes over time.",
  },
  {
    name: "Documents",
    text: "Upload household files and keep them next to estate records, so policies, titles, and statements are easy to find when you need them.",
  },
  {
    name: "Garage",
    text: "Log vehicles and maintenance so service history, costs, and upcoming work stay with each car instead of in a pile of receipts.",
  },
  {
    name: "Account Map",
    text: "See how income, accounts, and budgets connect. The map is a desktop view of cash flow paths between sources, accounts, and spending.",
  },
  {
    name: "Budget Setup",
    text: "Create and edit budget lines for income, expenses, savings, and more so each month has a plan before you start recording transactions.",
  },
  {
    name: "Budget Tracker",
    text: "Record and review monthly transactions against those budget lines, including imports and recategorizations as the month unfolds.",
  },
  {
    name: "Tax",
    text: "Roll up annual totals and estimated taxes owed so you can see the year in one place instead of reconstructing it from monthly budgets.",
  },
];

const { isStacked } = useMobileShell();
const visibleSections = computed(() =>
  isStacked.value ? sections.filter((item) => item.name !== "Account Map") : sections,
);

function loadDashboard() {
  void loadSummary();
  void loadBudgetChartData();
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
</script>

<template>
  <div v-if="!auth.ready" class="app-page">
    <p class="text-sm text-base-content/60">Loading session...</p>
  </div>

  <div
    v-else-if="!auth.user"
    class="app-page rounded-lg border border-warning/30 bg-warning/10 text-sm text-warning-content"
  >
    You must be logged in to use Financial Home.
  </div>

  <section v-else class="app-page overflow-x-hidden">
    <header class="mb-6 sm:mb-8">
      <h1 class="text-lg font-semibold text-base-content sm:text-xl">
        Financial Health
      </h1>
      <p class="mt-1 text-xs leading-5 text-base-content/60">
        Steward cash, accounts, and tax in one place. Use the tabs above to open a tool;
        the snapshot below is your current picture of net worth and budgets.
      </p>
    </header>

    <div class="mb-8">
      <details class="financial-learn-more group">
        <summary class="training-chip btn btn-primary btn-sm rounded-full w-fit cursor-pointer">
          Learn more
        </summary>
        <div class="mt-5 space-y-5">
          <section v-for="item in visibleSections" :key="item.name">
            <h2 class="!text-xs font-semibold text-gray-900">{{ item.name }}</h2>
            <p class="mt-1 text-xs leading-5 text-gray-600">{{ item.text }}</p>
          </section>
        </div>
      </details>
    </div>

    <header class="mb-4 sm:mb-6">
      <p class="text-sm font-medium text-gray-500 dark:text-gray-400">
        Current snapshot
      </p>
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
  </section>
</template>

<style scoped>
.financial-learn-more > summary {
  list-style: none;
}

.financial-learn-more > summary::-webkit-details-marker {
  display: none;
}
</style>
