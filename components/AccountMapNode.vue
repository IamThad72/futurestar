<template>
  <div
    class="account-map-node"
    :class="[`account-map-node--${data.nodeType}`, { 'account-map-node--selected': selected }]"
  >
    <Handle id="target-top" type="target" :position="Position.Top" class="account-map-handle" />
    <Handle id="source-top" type="source" :position="Position.Top" class="account-map-handle" />

    <Handle id="target-left" type="target" :position="Position.Left" class="account-map-handle" />
    <Handle id="source-left" type="source" :position="Position.Left" class="account-map-handle" />

    <div class="account-map-node__badge">{{ data.group }}</div>
    <div class="account-map-node__label">{{ data.label }}</div>
    <div v-if="data.subtitle" class="account-map-node__subtitle">{{ data.subtitle }}</div>
    <div v-if="data.amountLabel" class="account-map-node__amount">{{ data.amountLabel }}</div>

    <Handle id="target-right" type="target" :position="Position.Right" class="account-map-handle" />
    <Handle id="source-right" type="source" :position="Position.Right" class="account-map-handle" />

    <Handle id="target-bottom" type="target" :position="Position.Bottom" class="account-map-handle" />
    <Handle id="source-bottom" type="source" :position="Position.Bottom" class="account-map-handle" />
  </div>
</template>

<script setup>
import { Handle, Position } from "@vue-flow/core";

defineProps({
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false },
});
</script>

<style scoped>
.account-map-node {
  min-width: 160px;
  max-width: 220px;
  border: 1px solid color-mix(in srgb, var(--color-base-content, #151616) 18%, transparent);
  border-radius: 0.5rem;
  background: var(--color-base-100, #ffffff);
  color: var(--color-base-content, #151616);
  padding: 0.5rem 0.75rem;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--color-base-content, #151616) 8%, transparent);
  font-size: 0.8125rem;
}

.account-map-node--selected {
  border-color: var(--color-primary, #06b6d4);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary, #06b6d4) 25%, transparent);
}

.account-map-node--cash_and_investments {
  border-left: 3px solid #0284c7;
}
.account-map-node--debt {
  border-left: 3px solid #f87171;
}
.account-map-node--real_estate,
.account-map-node--asset_inventory,
.account-map-node--asset_vehicles,
.account-map-node--insurance {
  border-left: 3px solid #059669;
}
.account-map-node--income {
  border-left: 3px solid #7c3aed;
}
.account-map-node--expense {
  border-left: 3px solid #d97706;
}

.account-map-node__badge {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-base-content, #151616) 55%, transparent);
}

.account-map-node__label {
  margin-top: 0.125rem;
  font-weight: 600;
  line-height: 1.25;
  word-break: break-word;
}

.account-map-node__subtitle {
  margin-top: 0.125rem;
  font-size: 0.6875rem;
  color: color-mix(in srgb, var(--color-base-content, #151616) 62%, transparent);
  text-transform: capitalize;
}

.account-map-node__amount {
  margin-top: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.account-map-handle {
  width: 10px !important;
  height: 10px !important;
  background: var(--color-primary, #06b6d4) !important;
  border: 2px solid var(--color-base-100, #ffffff) !important;
}
</style>
