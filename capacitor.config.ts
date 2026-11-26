import type { CapacitorConfig } from "@capacitor/cli";

/**
 * CAPACITOR_DEV=true → HTTP scheme + cleartext (Android emulator + local API only).
 * Default (store builds) → HTTPS WebView scheme, no mixed content.
 *
 * Stay on this TypeScript file. @capacitor/cli 8.3 loads it with transpileModule,
 * and the dev branch above cannot be expressed in capacitor.config.json.
 * typescript ~5.9 is a direct devDependency so a hoisted TypeScript 7
 * (optional peer of Vue and Pinia) cannot take that API away.
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
      backgroundColor: "#FBF8F3",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    // Matches the parchment app background. "LIGHT" means dark text for a light bar;
    // plugins/status-bar.client.ts switches it at runtime for dark mode.
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#FBF8F3",
      overlaysWebView: false,
    },
  },
};

export default config;
