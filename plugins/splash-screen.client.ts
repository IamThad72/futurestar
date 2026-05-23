import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

export default defineNuxtPlugin(() => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  const hideSplash = async () => {
    try {
      await SplashScreen.hide();
    } catch {
      /* plugin unavailable in web dev */
    }
  };

  // Hide ASAP so the WebView is interactive; keep a fallback in case mount is delayed.
  void hideSplash();
  setTimeout(() => {
    void hideSplash();
  }, 2500);

  const nuxtApp = useNuxtApp();
  nuxtApp.hook("app:mounted", hideSplash);
});
