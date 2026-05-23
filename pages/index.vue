<script setup lang="ts">
const auth = useAuthStore();
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
  <!-- Unauthenticated: landing -->
  <div
    v-if="!auth.user"
    class="-mx-1 -mt-4 min-h-[calc(100dvh-8.5rem)] bg-zinc-50 px-4 py-12 pb-safe sm:-mx-3 sm:mt-0 sm:px-6 sm:py-16 lg:px-8"
  >
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <div class="flex items-center justify-center gap-2 text-lg font-semibold tracking-tight text-zinc-900">
        Future Star
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="size-7 text-primary"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
          />
        </svg>
      </div>
      <p class="mt-8 text-center text-sm text-zinc-600">
        Manage your Estate and your finances.
      </p>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <div>
        <AppLink class="btn btn-primary w-full min-h-11 rounded-full" to="/login">
          Log In
        </AppLink>
      </div>
      <p v-if="!auth.ready" class="mt-3 text-center text-xs text-zinc-500">
        Checking session…
      </p>
    </div>
  </div>

  <!-- Authenticated: dashboard snapshot -->
  <section v-else class="mx-auto w-full max-w-7xl py-4 sm:py-6 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
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
      <BudgetBarLineChart
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

    <p class="mt-4 text-center text-xs text-gray-500 md:text-sm dark:text-gray-400">
      <AppLink to="/estate_mgmt" class="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
        View full estate management →
      </AppLink>
    </p>
  </section>
</template>
