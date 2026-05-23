import { Capacitor } from "@capacitor/core";

/** True on Capacitor iOS/Android builds. */
export function useIsNativeApp() {
  return computed(
    () => import.meta.client && Capacitor.isNativePlatform(),
  );
}

function useMatchMedia(query) {
  const matches = ref(
    import.meta.client ? window.matchMedia(query).matches : false,
  );

  onMounted(() => {
    const mq = window.matchMedia(query);
    const update = () => {
      matches.value = mq.matches;
    };
    update();
    mq.addEventListener("change", update);
    onUnmounted(() => mq.removeEventListener("change", update));
  });

  return matches;
}

/**
 * Viewport helpers for Ionic shell and reliable mobile navigation.
 * Navigation stays in the top navbar (Tailwind disclosure), not a bottom tab bar.
 */
export function useMobileShell() {
  const isNative = useIsNativeApp();
  const isNarrow = useMatchMedia("(max-width: 639px)");

  const useMobileChrome = computed(() => isNative.value || isNarrow.value);

  return {
    isNative,
    isNarrow,
    useMobileChrome,
  };
}
