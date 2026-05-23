<template>
  <div
    v-if="!isOnline"
    class="offline-banner"
    role="status"
    aria-live="polite"
  >
    You're offline. Some features may not work until your connection returns.
  </div>
</template>

<script setup>
const { isOnline } = useOnlineStatus();
</script>

<style scoped>
.offline-banner {
  position: sticky;
  top: 0;
  z-index: 60;
  padding: 0.4rem 0.75rem;
  text-align: center;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.25rem;
  color: #fff;
  background-color: rgb(180 83 9);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.1);
}
</style>
