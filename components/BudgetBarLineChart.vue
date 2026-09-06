<template>
  <section class="mt-8 md:mt-10">
    <header class="mb-4">
      <h2 class="text-sm font-semibold text-gray-900 md:text-base dark:text-white">Budget vs actual</h2>
      <div
        v-if="!loading && (expenseData.length || otherData.length)"
        class="mt-3 flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-4"
      >
        <dl class="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          <div class="rounded-md border border-base-300 bg-base-100 px-3 py-2">
            <dt class="text-[0.65rem] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Income total
            </dt>
            <dd class="mt-0.5 text-base font-semibold tabular-nums text-gray-900 md:text-lg dark:text-white">
              ${{ formatChartMoneyRounded(incomeTotal) }}
            </dd>
          </div>
          <div class="rounded-md border border-base-300 bg-base-100 px-3 py-2">
            <dt class="text-[0.65rem] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Expense total
            </dt>
            <dd class="mt-0.5 text-base font-semibold tabular-nums text-gray-900 md:text-lg dark:text-white">
              ${{ formatChartMoneyRounded(expenseTotal) }}
            </dd>
          </div>
          <div class="rounded-md border border-base-300 bg-base-100 px-3 py-2">
            <dt class="text-[0.65rem] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Difference
            </dt>
            <dd
              class="mt-0.5 text-base font-semibold tabular-nums md:text-lg"
              :class="differenceClass"
            >
              {{ differenceLabel }}
            </dd>
          </div>
        </dl>

        <div
          class="rounded-md border border-base-300 bg-base-100 px-3 py-2 lg:min-w-[16rem] lg:max-w-sm lg:flex-1"
        >
          <p class="text-[0.65rem] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Over budget
          </p>
          <ul v-if="overBudgetCategories.length" class="mt-1.5 space-y-1">
            <li
              v-for="item in overBudgetCategories"
              :key="item.id"
              class="flex items-baseline justify-between gap-3 text-xs md:text-sm"
            >
              <span class="min-w-0 truncate text-gray-800 dark:text-gray-200">{{ item.label }}</span>
              <span class="shrink-0 font-semibold tabular-nums text-red-700 dark:text-red-400">
                +{{ item.pctLabel }}%
              </span>
            </li>
          </ul>
          <p v-else class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            None over budget
          </p>
        </div>
      </div>
    </header>

    <div
      v-if="loading"
      class="app-card px-4 py-12 text-center text-xs text-base-content/60 md:text-sm"
    >
      Loading charts…
    </div>

    <template v-else>
      <div v-if="!expenseData.length && !otherData.length" class="app-card px-4 py-12 text-center text-xs text-base-content/60 md:text-sm">
        No budget lines yet. Add items in Budget Setup to see these charts.
      </div>

      <div v-else class="space-y-10 md:space-y-12">
        <BudgetBarLineChartPanel
          title="Expenses"
          v-model:month="expenseMonth"
          v-model:year="expenseYear"
          :data="expenseData"
          :month-names="monthNames"
          :year-options="yearOptions"
          bar-color="#fecaca"
          line-color="#dc2626"
          empty-message="No expense categories for the selected month."
        />
        <BudgetBarLineChartPanel
          title="Personal Finances"
          v-model:month="otherMonth"
          v-model:year="otherYear"
          :data="otherData"
          :month-names="monthNames"
          :year-options="yearOptions"
          empty-message="No budget data for the selected month."
        />
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { BudgetChartRow } from "~/types/budgetChart";
import { formatChartMoneyRounded, formatSignedChartMoney } from "~/utils/budgetChart";

const expenseMonth = defineModel<number>("expenseMonth", { required: true });
const expenseYear = defineModel<number>("expenseYear", { required: true });
const otherMonth = defineModel<number>("otherMonth", { required: true });
const otherYear = defineModel<number>("otherYear", { required: true });

const props = defineProps<{
  expenseData: BudgetChartRow[];
  otherData: BudgetChartRow[];
  loading?: boolean;
  monthNames: string[];
  yearOptions: number[];
}>();

/** Net income actual from Personal Finances chart */
const incomeTotal = computed(() => {
  const net = props.otherData.find((r) => r.id === "summary-net-income");
  if (net) return Number(net.actual) || 0;
  return props.otherData
    .filter((r) => r.listType === "income")
    .reduce((sum, r) => sum + (Number(r.actual) || 0), 0);
});

/** Expense categories actual from Expenses chart */
const expenseTotal = computed(() =>
  props.expenseData.reduce((sum, r) => sum + (Number(r.actual) || 0), 0),
);

const difference = computed(() => incomeTotal.value - expenseTotal.value);

const differenceLabel = computed(() => formatSignedChartMoney(difference.value));

const differenceClass = computed(() => {
  const d = Math.round(difference.value);
  if (d > 0) return "text-emerald-700 dark:text-emerald-400";
  if (d < 0) return "text-red-700 dark:text-red-400";
  return "text-gray-900 dark:text-white";
});

/** Expense categories unfavorable vs budget, with overage as % of budgeted */
const overBudgetCategories = computed(() => {
  const items = [];
  for (const row of props.expenseData) {
    if (!row?.isOver) continue;
    const budgeted = Number(row.budgeted) || 0;
    const actual = Number(row.actual) || 0;
    if (budgeted <= 0) continue;
    const overAmount =
      row.listType === "income" ? budgeted - actual : actual - budgeted;
    if (overAmount <= 0) continue;
    const pct = (overAmount / budgeted) * 100;
    items.push({
      id: row.id,
      label: row.categoryLabel || row.label,
      pct,
      pctLabel: pct >= 10 ? String(Math.round(pct)) : pct.toFixed(1).replace(/\.0$/, ""),
    });
  }
  items.sort((a, b) => b.pct - a.pct);
  return items;
});
</script>
