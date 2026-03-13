<template>
  <div class="assets-vs-debt-chart" @click="$emit('click', $event, tooltipValues)">
    <VisXYContainer
      :data="data"
      :height="height"
      :padding="{ top: 8, right: 12, bottom: 8, left: 52 }"
      :duration="600"
      :x-domain="[-0.5, 1.5]"
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
        :bar-padding="0"
      />
      <VisAxis
        v-if="!hideXAxis"
        type="x"
        :tick-format="xFormatter"
        :tick-values="[0, 1]"
        :grid-line="false"
        :domain-line="!!xDomainLine"
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
import { ref, computed } from 'vue';

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
