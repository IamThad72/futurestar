import { createClient } from "@supabase/supabase-js";
import { ofetch } from "ofetch";

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig().public;
  const supabaseUrl = config.supabaseUrl as string;
  const supabaseKey = config.supabasePublishableKey as string;

  if (!supabaseUrl || !supabaseKey) {
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Add Supabase JWT to all /api/ requests so server can resolve app_user
  const apiFetch = ofetch.create({
    onRequest: async (ctx) => {
      const url =
        typeof ctx.request === "string"
          ? ctx.request
          : ctx.request instanceof Request
            ? ctx.request.url
            : String(ctx.request);
      if (!url.startsWith("/api/") && !url.includes("/api/")) return;

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
    if (url.startsWith("/api/") || url.includes("/api/")) {
      return apiFetch(input as any, init);
    }
    return originalFetch(input as any, init);
  };

  return { provide: { supabase } };
});
