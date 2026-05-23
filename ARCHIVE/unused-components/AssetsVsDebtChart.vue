<template>
  <div class="assets-vs-debt-chart" @click="$emit('click', $event, tooltipValues)">
    <VisXYContainer
      :data="data"
      :height="height"
      :padding="chartPadding"
      :duration="600"
      :x-domain="xDomain"
    >
      <VisTooltip
        :follow-cursor="true"
        :triggers="tooltipTriggers"
      />
      <VisStackedBar
        :data="data"
        :x="(_, i) => i"
        :y="yAccessors"
        :color="colorAccessor"
        :rounded-corners="2"
        :bar-padding="barPadding"
        :bar-max-width="barMaxWidth"
      />
      <VisAxis
        v-if="!hideXAxis"
        type="x"
        :tick-format="xFormatter"
        :tick-values="[0, 1]"
        :grid-line="false"
        :domain-line="!!xDomainLine"
        :tick-text-angle="xTickTextAngle"
        :tick-text-align="xTickTextAlign"
      />
      <VisAxis
        v-if="!hideYAxis"
        type="y"
        :tick-format="yFormatter"
        :grid-line="true"
        :domain-line="!!yDomainLine"
      />
    </VisXYContainer>
    <div ref="slotWrapperRef" style="display: none">
      <slot name="tooltip" :values="tooltipValues" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { VisXYContainer, VisStackedBar, VisAxis, VisTooltip, VisStackedBarSelectors } from '@unovis/vue';
import { ref, computed, onMounted, onUnmounted } from 'vue';

const MOBILE_MQ = '(max-width: 767px)';
const isMobile = ref(false);
let mobileMqCleanup: (() => void) | null = null;

onMounted(() => {
  const mq = window.matchMedia(MOBILE_MQ);
  const sync = () => {
    isMobile.value = mq.matches;
  };
  sync();
  mq.addEventListener('change', sync);
  mobileMqCleanup = () => mq.removeEventListener('change', sync);
});

onUnmounted(() => {
  mobileMqCleanup?.();
});

/** Narrower bars with more space between groups on narrow screens */
const barPadding = computed(() => (isMobile.value ? 0.6 : 0));
const barMaxWidth = computed(() => (isMobile.value ? 36 : 72));

const xDomain = computed(() => (isMobile.value ? [-0.75, 1.75] : [-0.5, 1.5]));

const xTickTextAngle = computed(() => (isMobile.value ? -45 : 0));
const xTickTextAlign = computed(() => (isMobile.value ? "right" : "center"));

const chartPadding = computed(() => ({
  top: 8,
  right: isMobile.value ? 8 : 12,
  bottom: isMobile.value ? 40 : 8,
  left: isMobile.value ? 40 : 52,
}));

interface ChartDatum {
  category: string;
  assets: number;
  debt: number;
}

interface CategoryConfig {
  name: string;
  color: string;
}

const props = withDefaults(
  defineProps<{
    data: ChartDatum[];
    height?: number;
    categories: Record<string, CategoryConfig>;
    xFormatter?: (tick: number) => string;
    yFormatter?: (tick: number) => string;
    formatMoney?: (n: number) => string;
    hideXAxis?: boolean;
    hideYAxis?: boolean;
    xDomainLine?: boolean;
    yDomainLine?: boolean;
  }>(),
  {
    height: 220,
    hideXAxis: false,
    hideYAxis: false,
    xDomainLine: false,
    yDomainLine: true,
  }
);

defineEmits<{
  click: [event: MouseEvent, values?: ChartDatum];
}>();

const slotWrapperRef = ref<HTMLElement | null>(null);
const tooltipValues = ref<ChartDatum | undefined>();

const yAccessors = computed(() => [
  (d: ChartDatum) => d.assets,
  (d: ChartDatum) => d.debt,
]);

const colorAccessor = (d: ChartDatum, i: number) => {
  const key = i === 0 ? 'assets' : 'debt';
  return props.categories[key]?.color ?? '#666';
};

const tooltipTriggers = {
  [VisStackedBarSelectors.bar]: (d: unknown) => {
    tooltipValues.value = (d as { datum?: ChartDatum })?.datum;
    return slotWrapperRef.value?.innerHTML ?? '';
  },
};
</script>

<style scoped>
.assets-vs-debt-chart :deep(.unovis-axis-tick text) {
  font-size: 4px;
  fill: rgb(107 114 128);
}
@media (min-width: 768px) {
  .assets-vs-debt-chart :deep(.unovis-axis-tick text) {
    font-size: 6px;
  }
}
.assets-vs-debt-chart :deep(.unovis-tooltip) {
  font-size: 10px;
  line-height: 1.25;
  padding: 6px 10px;
}
.assets-vs-debt-chart :deep(.unovis-tooltip *) {
  font-size: 10px;
  line-height: 1.25;
}
</style>
