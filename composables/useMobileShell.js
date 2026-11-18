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
 * Viewport helpers for the app shell.
 * Phones (and every native build) use a header plus a bottom tab bar.
 * Tablet and desktop widths use a left sidebar for the same five destinations.
 */
export function useMobileShell() {
  const isNative = useIsNativeApp();
  const isNarrow = useMatchMedia("(max-width: 639px)");
  /** Phone widths. Native builds always use the tab bar, including tablets. */
  const isPhone = useMatchMedia("(max-width: 767px)");
  /** Stacked content layouts and tap-to-add (below Tailwind `lg`). */
  const isStacked = useMatchMedia("(max-width: 1023px)");

  const useMobileChrome = computed(() => isNative.value || isPhone.value);
  const preferTapAdd = computed(() => isNative.value || isStacked.value);

  return {
    isNative,
    isNarrow,
    isPhone,
    isStacked,
    preferTapAdd,
    useMobileChrome,
  };
}
