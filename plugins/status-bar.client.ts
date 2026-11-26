import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

/** Status bar colors that match the Sacred Ledger app background (base-200). */
const STATUS_BAR_THEME = {
  light: { style: Style.Light, color: "#FBF8F3" },
  dark: { style: Style.Dark, color: "#0F1621" },
} as const;

/**
 * Keeps the native status bar readable: dark text on the light parchment
 * background, light text on the dark theme, and follows system dark mode.
 */
export default defineNuxtPlugin(() => {
  if (!Capacitor.isNativePlatform()) return;

  const query = window.matchMedia("(prefers-color-scheme: dark)");

  const apply = async () => {
    const theme = query.matches ? STATUS_BAR_THEME.dark : STATUS_BAR_THEME.light;
    try {
      await StatusBar.setStyle({ style: theme.style });
    } catch {
      /* plugin unavailable */
    }
    if (Capacitor.getPlatform() === "android") {
      try {
        // Ignored on Android 15+ edge-to-edge, where the bar is transparent.
        await StatusBar.setBackgroundColor({ color: theme.color });
      } catch {
        /* not supported on this Android version */
      }
    }
  };

  void apply();
  query.addEventListener("change", () => void apply());
});
