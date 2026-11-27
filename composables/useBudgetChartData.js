import { buildBudgetChartRows, buildOtherBudgetChartRows } from "~/utils/budgetChart";
import { settleLoadError } from "~/utils/parseFetchError";

export function useBudgetChartData() {
  const auth = useAuthStore();
  const loading = ref(false);
  const loadError = ref("");
  const budgets = ref({ income: [], expenses: [] });
  const transactions = ref([]);

  const now = new Date();
  const expenseMonth = ref(now.getMonth() + 1);
  const expenseYear = ref(now.getFullYear());
  const otherMonth = ref(now.getMonth() + 1);
  const otherYear = ref(now.getFullYear());

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const yearOptions = computed(() => {
    const current = now.getFullYear();
    const start = Math.min(current - 2, 2024);
    const end = Math.max(current + 5, 2032);
    const years = [];
    for (let y = start; y <= end; y++) years.push(y);
    return years;
  });

  const expenseChartRows = computed(() =>
    buildBudgetChartRows(
      budgets.value,
      transactions.value,
      expenseYear.value,
      expenseMonth.value,
    ).filter((r) => r.sectionKey === "expense"),
  );

  const otherChartRows = computed(() =>
    buildOtherBudgetChartRows(
      budgets.value,
      transactions.value,
      otherYear.value,
      otherMonth.value,
    ),
  );

  function clearCharts() {
    budgets.value = { income: [], expenses: [] };
    transactions.value = [];
  }

  async function loadBudgetChartData() {
    if (!auth.user) {
      clearCharts();
      loadError.value = "";
      loading.value = false;
      return;
    }
    loading.value = true;
    loadError.value = "";
    try {
      const [budgetData, txData] = await Promise.all([
        $fetch("/api/budget/list"),
        $fetch("/api/budget/transactions/list"),
      ]);
      budgets.value = {
        income: budgetData?.income ?? [],
        expenses: budgetData?.expenses ?? [],
      };
      const matched = Array.isArray(txData?.transactions)
        ? txData.transactions
        : Array.isArray(txData)
          ? txData
          : [];
      const orphans = Array.isArray(txData?.orphans) ? txData.orphans : [];
      transactions.value = orphans.length ? [...matched, ...orphans] : matched;
    } catch (error) {
      const failure = settleLoadError(error, "Failed to load budget charts.");
      clearCharts();
      loadError.value = failure.message;
      if (!failure.auth) console.error("Failed to load budget chart data", error);
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    loadError,
    expenseChartRows,
    otherChartRows,
    expenseMonth,
    expenseYear,
    otherMonth,
    otherYear,
    monthNames,
    yearOptions,
    loadBudgetChartData,
  };
}
