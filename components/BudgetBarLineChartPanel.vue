<template>
  <div class="space-y-2">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <h3 class="text-sm font-semibold text-gray-900 md:text-base dark:text-white">{{ title }}</h3>
      <div class="flex flex-wrap items-center gap-3 text-xs md:text-sm">
        <label class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
          <span class="font-medium">Month</span>
          <select
            v-model.number="month"
            class="rounded-md border border-gray-300 bg-white py-1.5 pl-2 pr-7 text-xs text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 md:text-sm dark:border-white/10 dark:bg-gray-900 dark:text-white"
          >
            <option v-for="m in 12" :key="m" :value="m">{{ monthNames[m - 1] }}</option>
          </select>
        </label>
        <label class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
          <span class="font-medium">Year</span>
          <select
            v-model.number="year"
            class="rounded-md border border-gray-300 bg-white py-1.5 pl-2 pr-7 text-xs text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 md:text-sm dark:border-white/10 dark:bg-gray-900 dark:text-white"
          >
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
          </select>
        </label>
      </div>
    </div>

    <div class="mb-2 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-300">
      <span class="inline-flex items-center gap-1.5">
        <span
          class="inline-block h-3 w-3 rounded-sm"
          :style="{ backgroundColor: barColor }"
          aria-hidden="true"
        />
        Budgeted
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="inline-block h-0.5 w-4" :style="{ backgroundColor: lineColor }" aria-hidden="true" />
        Actual
      </span>
    </div>

    <div
      v-if="!data.length"
      class="rounded-lg border border-gray-200 bg-white px-4 py-10 text-center text-xs text-gray-500 md:text-sm dark:border-white/10 dark:bg-gray-900/50 dark:text-gray-400"
    >
      {{ emptyMessage }}
    </div>

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-gray-200 bg-white p-3 sm:p-4 dark:border-white/10 dark:bg-gray-900/50"
    >
      <div
        class="budget-bar-line-chart relative"
        :style="{ minWidth: `${chartMinWidth}px`, height: `${height}px` }"
      >
        <VisXYContainer
          :data="data"
          :height="height"
          :padding="chartPaddingComputed"
          :x-domain="xDomain"
          :y-domain="yDomain"
        >
          <VisTooltip :triggers="tooltipTriggers" />
          <VisGroupedBar
            :x="xAccessor"
            :y="(d) => d.budgeted"
            :color="barColor"
            :rounded-corners="3"
            :group-max-width="groupMaxWidth"
            :group-padding="0"
          />
          <VisLine
            :x="xAccessor"
            :y="(d) => d.actual"
            :color="lineColor"
            :line-width="2.5"
            :point-size="6"
            :point-color="lineColor"
          />
          <VisAxis
            type="x"
            :tick-values="tickIndices"
            :tick-format="xTickFormat"
            :grid-line="false"
            :tick-padding="2"
            :tick-text-angle="xTickTextAngle"
            :tick-text-align="xTickTextAlign"
          />
          <VisAxis
            type="y"
            :tick-format="yTickFormat"
            :grid-line="true"
            :tick-padding="2"
          />
        </VisXYContainer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  VisXYContainer,
  VisGroupedBar,
  VisLine,
  VisAxis,
  VisTooltip,
  VisGroupedBarSelectors,
} from "@unovis/vue";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { formatChartMoneyRounded } from "~/utils/budgetChart";
import type { BudgetChartRow } from "~/types/budgetChart";

const month = defineModel<number>("month", { required: true });
const year = defineModel<number>("year", { required: true });

const props = withDefaults(
  defineProps<{
    title: string;
    data: BudgetChartRow[];
    monthNames: string[];
    yearOptions: number[];
    emptyMessage?: string;
    height?: number;
    barColor?: string;
    lineColor?: string;
  }>(),
  {
    emptyMessage: "No budget lines in this group for the selected month.",
    height: 300,
    barColor: "#c7d2fe",
    lineColor: "#4f46e5",
  },
);

const xAccessor = (_d: BudgetChartRow, i: number) => i;

const MOBILE_MQ = "(max-width: 767px)";
const isMobile = ref(false);

let mobileMqCleanup: (() => void) | null = null;

onMounted(() => {
  const mq = window.matchMedia(MOBILE_MQ);
  const sync = () => {
    isMobile.value = mq.matches;
  };
  sync();
  mq.addEventListener("change", sync);
  mobileMqCleanup = () => mq.removeEventListener("change", sync);
});

onUnmounted(() => {
  mobileMqCleanup?.();
});

const groupMaxWidth = computed(() => (isMobile.value ? 26 : 52));
const barColumnWidth = computed(() => (isMobile.value ? 36 : 48));

const xTickTextAngle = computed(() => (isMobile.value ? -45 : 0));
const xTickTextAlign = computed(() => (isMobile.value ? "right" : "center"));

const chartPaddingComputed = computed(() => ({
  top: 8,
  right: 12,
  bottom: isMobile.value ? 40 : 32,
  left: isMobile.value ? 24 : 28,
}));

const chartMinWidth = computed(() =>
  Math.max(280, props.data.length * barColumnWidth.value),
);

const xDomain = computed(() => {
  const n = props.data.length;
  if (n <= 1) return [-0.5, 0.5];
  return [0, n - 1];
});

const yDomain = computed(() => {
  let max = 0;
  for (const d of props.data) {
    max = Math.max(max, d.budgeted, d.actual);
  }
  const top = max <= 0 ? 100 : max * 1.15;
  return [0, top];
});

const tickIndices = computed(() => props.data.map((_, i) => i));

function xTickFormat(tick: number) {
  return props.data[tick]?.categoryLabel ?? props.data[tick]?.shortLabel ?? "";
}

function yTickFormat(tick: number) {
  const n = Math.round(tick);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function resolveChartRow(d: unknown, index?: number): BudgetChartRow | undefined {
  if (d != null && typeof d === "object") {
    const wrapped = d as { datum?: BudgetChartRow };
    if (wrapped.datum?.budgeted != null) return wrapped.datum;
    const direct = d as BudgetChartRow;
    if (direct.budgeted != null && direct.actual != null) return direct;
  }
  if (index != null && index >= 0 && index < props.data.length) {
    return props.data[index];
  }
  return undefined;
}

const tooltipTitleClass = "text-xs font-semibold leading-tight";
const tooltipLineClass = "text-[10px] leading-tight";

function budgetTooltipHtml(d: unknown, index?: number) {
  const row = resolveChartRow(d, index);
  if (!row) return null;
  const title = row.categoryLabel || row.label;
  const tag = "div";
  return [
    `<${tag} class="${tooltipTitleClass}">${title}</${tag}>`,
    `<${tag} class="${tooltipLineClass}">Budgeted: <span class="font-medium">$${formatChartMoneyRounded(row.budgeted)}</span></${tag}>`,
    `<${tag} class="${tooltipLineClass}">Actual: $${formatChartMoneyRounded(row.actual)}</${tag}>`,
    `<${tag} class="${tooltipLineClass} ${row.isOver ? "text-red-600" : "text-emerald-600"}">${row.varianceLabel}</${tag}>`,
  ].join("");
}

const tooltipTriggers = {
  [VisGroupedBarSelectors.bar]: budgetTooltipHtml,
};

</script>

<style scoped>
.budget-bar-line-chart :deep(.unovis-xy-container) {
  width: 100%;
}
.budget-bar-line-chart :deep(.unovis-axis-tick text) {
  font-size: 4px;
  fill: rgb(107 114 128);
}
@media (min-width: 768px) {
  .budget-bar-line-chart :deep(.unovis-axis-tick text) {
    font-size: 6px;
  }
}
.budget-bar-line-chart :deep(.unovis-tooltip) {
  font-size: 10px;
  line-height: 1.25;
  padding: 6px 10px;
}
</style>
