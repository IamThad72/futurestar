import tailwindcss from "@tailwindcss/vite";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const isProd = process.env.NODE_ENV === "production";
const isMobileProd = process.env.NUXT_MOBILE_PRODUCTION === "true";
const isCapacitorBuild = process.env.NUXT_CAPACITOR === "true";
const isVercel = process.env.VERCEL === "1" || process.env.NITRO_PRESET === "vercel";
const mobileBuildMode = process.env.CAPACITOR_DEV === "true" ? "dev" : isMobileProd ? "prod" : "capacitor";

/** Capacitor-only; key is nativeApiBase so NUXT_PUBLIC_API_BASE on Vercel does not override web builds */
const nativeApiBase = isCapacitorBuild ? process.env.NUXT_PUBLIC_API_BASE || "" : "";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: !isProd },
  app: {
    head: {
      viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
      meta: [{ name: "theme-color", content: "#1e3a8a" }],
    },
  },
  runtimeConfig: {
    // Server-only (never exposed to client). Override via NUXT_MCP_BASE_URL, NUXT_MCP_TOKEN
    mcpBaseUrl: "",
    mcpToken: "",
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
      /** Backend URL for native builds (Capacitor). Example: https://api.myfin.example.com */
      nativeApiBase,
      /** Baked in when NUXT_CAPACITOR=true; used by native hash-router plugin */
      isCapacitorBuild,
    },
  },

  // Tailwind v4 via Vite plugin
  vite: { plugins: [tailwindcss()] },

  // Global CSS (Tailwind + daisyUI). Ionic styles are added by @nuxtjs/ionic.
  css: ["~/assets/css/main.css"],

  modules: ["@pinia/nuxt", "nuxt-headlessui", "nuxt-charts", "@nuxtjs/ionic"],

  ionic: {
    config: {
      mode: "ios",
    },
    // Use Nuxt/vue-router so NuxtLink, layouts, and page scroll work normally.
    integrations: {
      router: false,
    },
  },

  // Required for Capacitor (app must run fully client-side)
  ssr: false,

  // SPA + static Capacitor builds: app manifest fetch (/_nuxt/builds/meta/dev.json) 404s and can show error page
  experimental: {
    appManifest: false,
  },

  // Hash routing for Capacitor static shell (also in router.options.ts)
  router: {
    options: {
      hashMode: isCapacitorBuild,
    },
  },

  nitro: {
    // Vercel: SPA shell from __fallback so HTML and /_nuxt/* assets always match one build
    preset: isVercel || (isProd && !isCapacitorBuild) ? "vercel" : undefined,
    prerender: {
      crawlLinks: false,
      routes: isCapacitorBuild ? ["/"] : [],
    },
    vercel: {
      config: {
        routes: [
          {
            src: "/_nuxt/(.*)",
            headers: {
              "cache-control": "public, max-age=31536000, immutable",
            },
            continue: true,
          },
          { handle: "filesystem" },
          { src: "/(.*)", dest: "/__fallback" },
        ],
      },
    },
  },

  devServer: {
    host: "0.0.0.0",
    port: 3000,
  },

  hooks: {
    close() {
      if (!isCapacitorBuild) return;
      const distDir = resolve(process.cwd(), "dist");
      writeFileSync(
        resolve(distDir, ".capacitor-hash-build.json"),
        JSON.stringify(
          {
            hashMode: true,
            mode: mobileBuildMode,
            builtAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    },
  },
});