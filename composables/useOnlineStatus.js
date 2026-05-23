/** Reactive browser online/offline state. */
export function useOnlineStatus() {
  const isOnline = ref(import.meta.client ? navigator.onLine : true);

  function sync() {
    if (import.meta.client) {
      isOnline.value = navigator.onLine;
    }
  }

  onMounted(() => {
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    onUnmounted(() => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    });
  });

  return { isOnline };
}
