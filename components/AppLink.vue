<template>
  <NuxtLink :to="to" v-bind="attrsWithoutClick" @click="onClick">
    <slot />
  </NuxtLink>
</template>

<script setup>
defineOptions({ inheritAttrs: false });

const props = defineProps({
  to: {
    type: String,
    required: true,
  },
});

const attrs = useAttrs();
const { go, useReliableNav } = useAppNavigate();

const attrsWithoutClick = computed(() => {
  const { onClick, ...rest } = attrs;
  return rest;
});

function onClick(event) {
  if (useReliableNav.value) {
    event.preventDefault();
    void go(props.to);
  }

  const parentClick = attrs.onClick;
  if (typeof parentClick === "function") {
    parentClick(event);
  }
}
</script>
