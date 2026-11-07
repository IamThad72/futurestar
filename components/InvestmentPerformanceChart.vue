<template>
  <div
    class="overflow-hidden rounded-lg border border-base-300 bg-base-100 p-3 sm:p-4"
    role="img"
    :aria-label="chartLabel"
  >
    <div
      class="investment-performance-chart relative"
      :style="{ height: `${chartHeight}px` }"
    >
      <VisXYContainer
        :data="plotRows"
        :height="chartHeight"
        :padding="chartPadding"
        :x-domain="xDomain"
        :y-domain="yDomain"
      >
        <VisTooltip :triggers="tooltipTriggers" />
        <VisStackedBar
          orientation="horizontal"
          :x="xAccessor"
          :y="valueAccessors"
          :color="barColor"
          :rounded-corners="2"
          :bar-max-width="barMaxWidth"
          :bar-padding="0.35"
        />
        <VisAxis type="x" :tick-format="dollarTick" :grid-line="true" :tick-padding="6" />
        <VisAxis
          type="y"
          :tick-values="tickIndices"
          :tick-format="labelTick"
          :grid-line="false"
          :tick-padding="8"
        />
      </VisXYContainer>
    </div>
  </div>
</template>

<script setup>
import { VisAxis, VisStackedBar, VisStackedBarSelectors, VisTooltip, VisXYContainer } from "@unovis/vue";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { formatInvestmentCurrency, formatInvestmentPercent } from "~/utils/investmentFormat";

const props = defineProps({
  rows: { type: Array, required: true },
  currency: { type: String, default: "USD" },
});

const isMobile = ref(false);
let mobileCleanup = null;

onMounted(() => {
  const mq = window.matchMedia("(max-width: 767px)");
  const sync = () => {
    isMobile.value = mq.matches;
  };
  sync();
  mq.addEventListener("change", sync);
  mobileCleanup = () => mq.removeEventListener("change", sync);
});

onUnmounted(() => {
  mobileCleanup?.();
});

const plotRows = computed(() => [...props.rows].reverse());
const xAccessor = (_row, index) => index;
const valueAccessors = [
  (row) => row.base,
  (row) => row.gain,
  (row) => row.loss,
];

const chartHeight = computed(() => Math.max(220, plotRows.value.length * (isMobile.value ? 52 : 48) + 56));
const barMaxWidth = computed(() => (isMobile.value ? 22 : 28));
const chartPadding = computed(() => ({
  top: 8,
  right: 16,
  bottom: 32,
  left: isMobile.value ? 132 : 176,
}));

const yDomain = computed(() => {
  const count = plotRows.value.length;
  if (count <= 1) return [-0.6, 0.6];
  return [-0.6, count - 0.4];
});

const xDomain = computed(() => {
  let max = 0;
  for (const row of plotRows.value) {
    const total = Number(row.base) + Number(row.gain) + Number(row.loss);
    if (Number.isFinite(total)) max = Math.max(max, total);
  }
  return [0, max <= 0 ? 1 : max * 1.08];
});

const tickIndices = computed(() => plotRows.value.map((_, index) => index));

const chartLabel = computed(() => {
  const names = props.rows.map((row) => row.name).join(", ");
  return `Horizontal stacked bar chart of account value, unrealized gain, and unrealized loss for ${names}. Exact amounts are in the holdings table.`;
});

function dollarTick(tick) {
  const amount = Number(tick);
  if (!Number.isFinite(amount)) return "";
  if (Math.abs(amount) >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `$${Math.round(amount / 1_000)}k`;
  return `$${Math.round(amount)}`;
}

function labelTick(tick) {
  return plotRows.value[tick]?.name || "";
}

function barColor(_row, seriesIndex) {
  if (seriesIndex === 0) return "#9ca3af";
  if (seriesIndex === 2) return "#dc2626";
  return "#059669";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function tooltipHtml(datum) {
  const row = datum?.datum ?? datum;
  if (!row) return null;
  const money = (amount, signed = false) =>
    escapeHtml(formatInvestmentCurrency(amount, props.currency, { signed }));
  const lines = [
    `<div class="text-xs font-semibold">${escapeHtml(row.name)}</div>`,
    `<div class="text-[10px]">Account value: ${money(row.currentValue)}</div>`,
  ];
  if (Number.isFinite(row.costBasis)) {
    lines.push(`<div class="text-[10px]">Cost basis: ${money(row.costBasis)}</div>`);
  }
  if (row.gain > 0) lines.push(`<div class="text-[10px]">Unrealized gain: ${money(row.gain, true)}</div>`);
  if (row.loss > 0) lines.push(`<div class="text-[10px]">Unrealized loss: ${money(-row.loss, true)}</div>`);
  if (Number.isFinite(row.gainDollars)) {
    lines.push(
      `<div class="text-[10px]">Net unrealized gain/loss: ${money(row.gainDollars, true)} (${escapeHtml(formatInvestmentPercent(row.gainPercent))})</div>`,
    );
  }
  return lines.join("");
}

const tooltipTriggers = {
  [VisStackedBarSelectors.bar]: tooltipHtml,
};
</script>

<style scoped>
.investment-performance-chart :deep(.unovis-xy-container) {
  width: 100%;
}
.investment-performance-chart :deep(.unovis-axis-tick text) {
  font-size: 11px;
  fill: rgb(75 85 99);
}
:global(:root[data-theme="dark"]) .investment-performance-chart :deep(.unovis-axis-tick text) {
  fill: rgb(209 213 219);
}
.investment-performance-chart :deep(.unovis-tooltip) {
  font-size: 11px;
  line-height: 1.35;
  padding: 6px 10px;
}
</style>
