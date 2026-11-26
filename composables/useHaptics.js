/**
 * Native haptic feedback. Each method is a no-op on the web and swallows
 * plugin errors so a missing vibrator never breaks the screen.
 */
export function useHaptics() {
  let nativeApi;

  async function api() {
    if (nativeApi !== undefined) return nativeApi;
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) {
        nativeApi = null;
        return null;
      }
      nativeApi = await import("@capacitor/haptics");
      return nativeApi;
    } catch {
      nativeApi = null;
      return null;
    }
  }

  async function run(fn) {
    try {
      const haptics = await api();
      if (!haptics) return;
      await fn(haptics);
    } catch {
      // Web and devices without a vibrator stay silent.
    }
  }

  return {
    selection() {
      void run(({ Haptics }) => Haptics.selectionChanged());
    },
    light() {
      void run(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }));
    },
    success() {
      void run(({ Haptics, NotificationType }) => Haptics.notification({ type: NotificationType.Success }));
    },
    warning() {
      void run(({ Haptics, NotificationType }) => Haptics.notification({ type: NotificationType.Warning }));
    },
  };
}
