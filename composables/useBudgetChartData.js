import { buildBudgetChartRows, buildOtherBudgetChartRows } from "~/utils/budgetChart";
import { parseFetchError } from "~/utils/parseFetchError";

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

  async function loadBudgetChartData() {
    if (!auth.user) return;
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
      transactions.value = txData?.transactions ?? txData ?? [];
    } catch (error) {
      console.error("Failed to load budget chart data", error);
      loadError.value = parseFetchError(error, "Failed to load budget charts.");
      budgets.value = { income: [], expenses: [] };
      transactions.value = [];
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
