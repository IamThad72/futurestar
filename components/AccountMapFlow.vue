<template>
  <VueFlow
    v-model:nodes="nodes"
    v-model:edges="edges"
    :node-types="nodeTypes"
    :default-edge-options="defaultEdgeOptions"
    fit-view-on-init
    class="account-map-canvas"
    @connect="$emit('connect', $event)"
    @edge-click="$emit('edge-click', $event)"
    @node-click="$emit('node-click', $event)"
    @pane-click="$emit('pane-click', $event)"
    @node-drag-stop="$emit('node-drag-stop', $event)"
  >
    <Background pattern-color="#94a3b8" :gap="18" />
    <Controls />
    <MiniMap />
  </VueFlow>
</template>

<script setup>
import { VueFlow } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import { MiniMap } from "@vue-flow/minimap";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";
import "@vue-flow/minimap/dist/style.css";

const nodes = defineModel("nodes", { type: Array, required: true });
const edges = defineModel("edges", { type: Array, required: true });

defineProps({
  nodeTypes: { type: Object, required: true },
  defaultEdgeOptions: { type: Object, required: true },
});

defineEmits(["connect", "edge-click", "node-click", "pane-click", "node-drag-stop"]);
</script>
