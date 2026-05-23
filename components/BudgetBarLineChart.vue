<template>
  <section class="mt-8 md:mt-10">
    <header class="mb-4">
      <h2 class="text-sm font-semibold text-gray-900 md:text-base dark:text-white">Budget vs actual</h2>
    </header>

    <div
      v-if="loading"
      class="rounded-lg border border-gray-200 bg-white px-4 py-12 text-center text-xs text-gray-500 md:text-sm dark:border-white/10 dark:bg-gray-900/50 dark:text-gray-400"
    >
      Loading charts…
    </div>

    <template v-else>
      <div v-if="!expenseData.length && !otherData.length" class="rounded-lg border border-gray-200 bg-white px-4 py-12 text-center text-xs text-gray-500 md:text-sm dark:border-white/10 dark:bg-gray-900/50 dark:text-gray-400">
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
import type { BudgetChartRow } from "~/types/budgetChart";

const expenseMonth = defineModel<number>("expenseMonth", { required: true });
const expenseYear = defineModel<number>("expenseYear", { required: true });
const otherMonth = defineModel<number>("otherMonth", { required: true });
const otherYear = defineModel<number>("otherYear", { required: true });

defineProps<{
  expenseData: BudgetChartRow[];
  otherData: BudgetChartRow[];
  loading?: boolean;
  monthNames: string[];
  yearOptions: number[];
}>();
</script>
