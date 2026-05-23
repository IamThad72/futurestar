import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * Capacitor static WebView helpers: hash URL normalization + Android back button.
 */
export default defineNuxtPlugin(() => {
  if (!Capacitor.isNativePlatform()) return;

  const router = useRouter();
  const config = useRuntimeConfig().public;

  if (!config.isCapacitorBuild) {
    console.warn(
      "[capacitor-hash-router] Rebuild with npm run cap:sync:dev — isCapacitorBuild is false",
    );
  }

  const buildId = useNuxtApp().payload?.config?.app?.buildId ?? "unknown";
  console.info("[myfin native]", { buildId, hash: window.location.hash });

  function normalizeToHashRoute() {
    const { pathname, search, hash } = window.location;
    if (hash.startsWith("#/")) return;

    const base = pathname.replace(/\/index\.html$/i, "") || "/";
    const pathFromPathname =
      base !== "/" && base !== "" ? (base.startsWith("/") ? base : `/${base}`) : "";

    if (!pathFromPathname) return;

    const full = `${pathFromPathname}${search}`;
    void router.replace(full);
    window.location.hash = `#${full.startsWith("/") ? full : `/${full}`}`;
  }

  normalizeToHashRoute();

  App.addListener("backButton", () => {
    router.back();
  });
});
