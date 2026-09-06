<template>
  <section class="app-card px-4 py-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Calories by day</h2>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Stacked bars are calories from protein (×4), carbs (×4), and fat (×9). The line is logged kcal.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="option in rangeOptions"
          :key="option"
          type="button"
          class="training-chip btn btn-xs rounded-full"
          :class="days === option ? 'btn-primary' : 'btn-ghost bg-base-200'"
          @click="days = option"
        >
          {{ option }} days
        </button>
      </div>
    </div>

    <div class="mt-3 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-300">
      <span v-for="item in legendItems" :key="item.key" class="inline-flex items-center gap-1.5">
        <span
          v-if="item.kind === 'bar'"
          class="inline-block h-3 w-3 rounded-sm"
          :style="{ backgroundColor: item.color }"
          aria-hidden="true"
        />
        <span
          v-else
          class="inline-block h-0.5 w-4"
          :style="{ backgroundColor: item.color }"
          aria-hidden="true"
        />
        {{ item.label }}
      </span>
    </div>

    <div
      v-if="loading"
      class="mt-3 rounded-lg border border-gray-200 bg-white px-4 py-10 text-center text-xs text-gray-500 md:text-sm dark:border-white/10 dark:bg-gray-900/40 dark:text-gray-400"
    >
      Loading chart…
    </div>
    <p v-else-if="error" class="mt-3 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
    <div
      v-else-if="!hasIntake"
      class="mt-3 rounded-lg border border-gray-200 bg-white px-4 py-10 text-center text-xs text-gray-500 md:text-sm dark:border-white/10 dark:bg-gray-900/40 dark:text-gray-400"
    >
      No foods logged in this range yet.
    </div>
    <div
      v-else
      class="mt-3 overflow-x-auto rounded-lg border border-gray-200 bg-white p-3 sm:p-4 dark:border-white/10 dark:bg-gray-900/40"
    >
      <div
        class="nutrition-daily-chart relative"
        :style="{ minWidth: `${chartMinWidth}px`, height: `${height}px` }"
      >
        <VisXYContainer
          :data="chartRows"
          :height="height"
          :padding="chartPaddingComputed"
          :x-domain="xDomain"
          :y-domain="yDomain"
        >
          <VisTooltip :triggers="tooltipTriggers" />
          <VisStackedBar
            :x="xAccessor"
            :y="yAccessors"
            :color="STACK_COLORS"
            :rounded-corners="3"
            :bar-padding="barPadding"
            :bar-max-width="barMaxWidth"
          />
          <VisLine
            :x="xAccessor"
            :y="(d) => d.kcal"
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
  </section>
</template>

<script setup lang="ts">
import {
  VisXYContainer,
  VisStackedBar,
  VisLine,
  VisAxis,
  VisTooltip,
  VisStackedBarSelectors,
} from "@unovis/vue";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { formatWeightOzGrams } from "~/utils/foodPortionLabel";

export type NutritionHistoryDay = {
  eaten_on: string;
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carb_g: number | null;
};

type ChartRow = {
  id: string;
  eaten_on: string;
  label: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  proteinKcal: number;
  fatKcal: number;
  carbKcal: number;
  macroKcal: number;
};

const PROTEIN_KCAL_PER_G = 4;
const CARB_KCAL_PER_G = 4;
const FAT_KCAL_PER_G = 9;
const PROTEIN_COLOR = "#7c3aed";
const FAT_COLOR = "#ea580c";
const CARB_COLOR = "#0d9488";
const lineColor = "#0ea5e9";
const STACK_COLORS = [PROTEIN_COLOR, FAT_COLOR, CARB_COLOR];
const rangeOptions = [7, 14] as const;

const days = defineModel<number>("days", { default: 7 });

const props = withDefaults(
  defineProps<{
    data: NutritionHistoryDay[];
    loading?: boolean;
    error?: string;
    height?: number;
  }>(),
  {
    loading: false,
    error: "",
    height: 280,
  },
);

const legendItems = [
  { key: "protein", kind: "bar" as const, color: PROTEIN_COLOR, label: "Protein kcal" },
  { key: "fat", kind: "bar" as const, color: FAT_COLOR, label: "Fat kcal" },
  { key: "carb", kind: "bar" as const, color: CARB_COLOR, label: "Carb kcal" },
  { key: "logged", kind: "line" as const, color: lineColor, label: "Logged calories" },
];

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

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatDayLabel(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" });
}

function formatKcal(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const chartRows = computed<ChartRow[]>(() =>
  (props.data || []).map((row) => {
    const protein_g = asNumber(row.protein_g);
    const fat_g = asNumber(row.fat_g);
    const carb_g = asNumber(row.carb_g);
    const proteinKcal = protein_g * PROTEIN_KCAL_PER_G;
    const fatKcal = fat_g * FAT_KCAL_PER_G;
    const carbKcal = carb_g * CARB_KCAL_PER_G;
    return {
      id: row.eaten_on,
      eaten_on: row.eaten_on,
      label: formatDayLabel(row.eaten_on),
      kcal: asNumber(row.kcal),
      protein_g,
      fat_g,
      carb_g,
      proteinKcal,
      fatKcal,
      carbKcal,
      macroKcal: proteinKcal + fatKcal + carbKcal,
    };
  }),
);

const hasIntake = computed(() =>
  chartRows.value.some((row) => row.kcal > 0 || row.macroKcal > 0),
);

const xAccessor = (_d: ChartRow, i: number) => i;
const yAccessors = [
  (d: ChartRow) => d.proteinKcal,
  (d: ChartRow) => d.fatKcal,
  (d: ChartRow) => d.carbKcal,
];

const barPadding = computed(() => (isMobile.value ? 0.35 : 0.22));
const barMaxWidth = computed(() => (isMobile.value ? 28 : 48));
const barColumnWidth = computed(() => (isMobile.value ? 40 : 52));
const xTickTextAngle = computed(() => (isMobile.value ? -45 : 0));
const xTickTextAlign = computed(() => (isMobile.value ? "right" : "center"));

const chartPaddingComputed = computed(() => ({
  top: 8,
  right: 12,
  bottom: isMobile.value ? 44 : 32,
  left: isMobile.value ? 28 : 36,
}));

const chartMinWidth = computed(() =>
  Math.max(280, chartRows.value.length * barColumnWidth.value),
);

const xDomain = computed(() => {
  const n = chartRows.value.length;
  if (n <= 1) return [-0.5, 0.5];
  return [0, n - 1];
});

const yDomain = computed(() => {
  let max = 0;
  for (const row of chartRows.value) {
    max = Math.max(max, row.macroKcal, row.kcal);
  }
  const top = max <= 0 ? 100 : max * 1.15;
  return [0, top];
});

const tickIndices = computed(() => chartRows.value.map((_, i) => i));

function xTickFormat(tick: number) {
  return chartRows.value[tick]?.label ?? "";
}

function yTickFormat(tick: number) {
  const n = Math.round(tick);
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}

function resolveChartRow(d: unknown, index?: number): ChartRow | undefined {
  if (d != null && typeof d === "object") {
    const wrapped = d as { datum?: ChartRow };
    if (wrapped.datum?.eaten_on) return wrapped.datum;
    const direct = d as ChartRow;
    if (direct.eaten_on) return direct;
  }
  if (index != null && index >= 0 && index < chartRows.value.length) {
    return chartRows.value[index];
  }
  return undefined;
}

const tooltipTitleClass = "text-xs font-semibold leading-tight";
const tooltipLineClass = "text-[10px] leading-tight";

function nutritionTooltipHtml(d: unknown, index?: number) {
  const row = resolveChartRow(d, index);
  if (!row) return null;
  const tag = "div";
  const lines = [
    `<${tag} class="${tooltipTitleClass}">${row.label}</${tag}>`,
    `<${tag} class="${tooltipLineClass}">Protein: ${formatWeightOzGrams(row.protein_g)} · ${formatKcal(row.proteinKcal)} kcal</${tag}>`,
    `<${tag} class="${tooltipLineClass}">Fat: ${formatWeightOzGrams(row.fat_g)} · ${formatKcal(row.fatKcal)} kcal</${tag}>`,
    `<${tag} class="${tooltipLineClass}">Carbs: ${formatWeightOzGrams(row.carb_g)} · ${formatKcal(row.carbKcal)} kcal</${tag}>`,
    `<${tag} class="${tooltipLineClass}">Macro kcal: ${formatKcal(row.macroKcal)}</${tag}>`,
    `<${tag} class="${tooltipLineClass}">Logged calories: ${formatKcal(row.kcal)} kcal</${tag}>`,
  ];
  if (Math.abs(row.kcal - row.macroKcal) >= 1) {
    lines.push(
      `<${tag} class="${tooltipLineClass} text-gray-500">Logged kcal can differ from 4/4/9 when foods include fiber, alcohol, or rounding.</${tag}>`,
    );
  }
  return lines.join("");
}

const tooltipTriggers = {
  [VisStackedBarSelectors.bar]: nutritionTooltipHtml,
};
</script>

<style scoped>
.nutrition-daily-chart :deep(.unovis-xy-container) {
  width: 100%;
}
.nutrition-daily-chart :deep(.unovis-axis-tick text) {
  font-size: 4px;
  fill: rgb(107 114 128);
}
@media (min-width: 768px) {
  .nutrition-daily-chart :deep(.unovis-axis-tick text) {
    font-size: 6px;
  }
}
.nutrition-daily-chart :deep(.unovis-tooltip) {
  font-size: 10px;
  line-height: 1.25;
  padding: 6px 10px;
}
</style>
