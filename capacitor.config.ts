import type { CapacitorConfig } from "@capacitor/cli";

/**
 * CAPACITOR_DEV=true → HTTP scheme + cleartext (Android emulator + local API only).
 * Default (store builds) → HTTPS WebView scheme, no mixed content.
 */
const isDev = process.env.CAPACITOR_DEV === "true" || process.env.MOBILE_DEV === "true";

const config: CapacitorConfig = {
  appId: "com.futurestar.myfin",
  appName: "Future Star",
  webDir: "dist",
  server: isDev
    ? {
        cleartext: true,
        androidScheme: "http",
      }
    : {
        androidScheme: "https",
      },
  android: isDev
    ? {
        allowMixedContent: true,
      }
    : {},
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 0,
      backgroundColor: "#1e3a8a",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#1e3a8a",
    },
  },
};

export default config;
