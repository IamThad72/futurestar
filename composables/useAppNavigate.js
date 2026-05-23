import { Capacitor } from "@capacitor/core";

/**
 * Reliable in-app navigation (Ionic shell, Android WebView, hash routes).
 * Prefer this over raw NuxtLink clicks for tab bar, hamburger, and CTAs.
 */
export function useAppNavigate() {
  const router = useRouter();
  const route = useRoute();
  const { useMobileChrome } = useMobileShell();

  const isNative = computed(
    () => import.meta.client && Capacitor.isNativePlatform(),
  );

  /** ion-app + narrow viewport: default link clicks are unreliable */
  const useReliableNav = computed(
    () => isNative.value || useMobileChrome.value,
  );

  function isSameRoute(target) {
    const normalized = target.startsWith("/") ? target : `/${target}`;
    if (route.path === normalized || route.fullPath === normalized) return true;
    if (route.hash && route.hash.replace(/^#/, "") === normalized) return true;
    return false;
  }

  async function go(path, options = {}) {
    const target = path.startsWith("/") ? path : `/${path}`;
    if (isSameRoute(target)) return;

    if (isNative.value) {
      await navigateTo(target, { replace: options.replace ?? false });
      return;
    }

    if (options.replace) {
      await router.replace(target);
    } else {
      await router.push(target);
    }
  }

  return { go, isNative, useReliableNav };
}
