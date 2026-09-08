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
 * Narrow viewports and native builds use Ionic header/menu/content;
 * desktop keeps the daisyUI navbar. No bottom tab bar.
 */
export function useMobileShell() {
  const isNative = useIsNativeApp();
  const isNarrow = useMatchMedia("(max-width: 639px)");
  /** Stacked workout layout / tap-to-add (below Tailwind `lg`). */
  const isStacked = useMatchMedia("(max-width: 1023px)");

  const useMobileChrome = computed(() => isNative.value || isNarrow.value);
  const preferTapAdd = computed(() => isNative.value || isStacked.value);

  return {
    isNative,
    isNarrow,
    isStacked,
    preferTapAdd,
    useMobileChrome,
  };
}
