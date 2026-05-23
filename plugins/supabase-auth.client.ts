import { createClient } from "@supabase/supabase-js";
import { ofetch } from "ofetch";
import { getNativeApiBase, isApiPath, resolveNativeApiUrl } from "~/utils/native-api-base";

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig().public;
  const supabaseUrl = config.supabaseUrl as string;
  const supabaseKey = config.supabasePublishableKey as string;

  if (!supabaseUrl || !supabaseKey) {
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const nativeApiBase = getNativeApiBase(config.apiBase);

  // Add Supabase JWT to all /api/ requests so server can resolve app_user
  const apiFetch = ofetch.create({
    baseURL: nativeApiBase || undefined,
    onRequest: async (ctx) => {
      const rawUrl =
        typeof ctx.request === "string"
          ? ctx.request
          : ctx.request instanceof Request
            ? ctx.request.url
            : String(ctx.request);

      const url = resolveNativeApiUrl(rawUrl, config.apiBase);
      if (url !== rawUrl) {
        ctx.request = url;
      }

      if (!isApiPath(url)) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        ctx.options.headers = {
          ...(ctx.options.headers as Record<string, string>),
          Authorization: `Bearer ${token}`,
        };
      }
    },
  });

  // Override global $fetch for /api/ URLs so they get the JWT
  const originalFetch = globalThis.$fetch;
  (globalThis as any).$fetch = async (input: string | Request | URL, init?: any) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : String(input);
    if (isApiPath(url)) {
      return apiFetch(input as any, init);
    }
    return originalFetch(input as any, init);
  };

  return { provide: { supabase } };
});
