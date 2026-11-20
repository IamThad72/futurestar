<template>
  <component :is="icon" :size="size" :stroke-width="strokeWidth" aria-hidden="true" />
</template>

<script setup>
import {
  Activity,
  Church,
  CircleUser,
  Flame,
  Info,
  Landmark,
  Pencil,
  Receipt,
  Sparkles,
  Star,
  Users,
} from "lucide-vue-next";

const ICONS = {
  activity: Activity,
  church: Church,
  "circle-user": CircleUser,
  flame: Flame,
  info: Info,
  landmark: Landmark,
  pencil: Pencil,
  receipt: Receipt,
  sparkles: Sparkles,
  star: Star,
  users: Users,
};

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 24 },
  strokeWidth: { type: [Number, String], default: 1.75 },
});

const icon = computed(() => ICONS[props.name] || Sparkles);
</script>
