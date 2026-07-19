import { resolveNativeApiUrl } from "~/utils/native-api-base";

/**
 * On iOS/Android the static bundle has no Nitro server; point $fetch at a deployed API.
 * Runs after other plugins (e.g. supabase-auth) so all /api/ calls get the correct host.
 * Set NUXT_PUBLIC_API_BASE (e.g. https://your-app.vercel.app) before `npm run build:mobile`.
 */
export default defineNuxtPlugin({
  enforce: "post",
  setup() {
    const {
      public: { nativeApiBase },
    } = useRuntimeConfig();

    const prevFetch = globalThis.$fetch;
    globalThis.$fetch = async (input: string | Request | URL, init?: Parameters<typeof $fetch>[1]) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : String(input);

      const resolved = resolveNativeApiUrl(url, nativeApiBase);
      if (resolved === url) {
        return prevFetch(input as never, init);
      }

      if (typeof input === "string") {
        return prevFetch(resolved, init);
      }
      if (input instanceof Request) {
        return prevFetch(new Request(resolved, input), init);
      }
      return prevFetch(new URL(resolved), init);
    };
  },
});
