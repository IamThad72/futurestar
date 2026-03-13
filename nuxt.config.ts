import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  app: {
    head: {
      viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
      meta: [{ name: "theme-color", content: "#1e3a8a" }],
    },
  },
  runtimeConfig: {
    public: {
      mcpBaseUrl: "https://usfoods.leanix.net/services/mcp-server/v1/mcp",
      mcpToken: "LXT_xQn7EbGBDwf2xTRkS3djzvuVqbXZvqwYVYj3jBzD",
    },
  },

  // Tailwind v4 via Vite plugin
  vite: { plugins: [tailwindcss()] },

  // Global CSS (Tailwind + daisyUI)
  css: ["~/assets/css/ionic-basic.css","~/assets/css/main.css"],

  modules: ["@pinia/nuxt", "@nuxtjs/ionic", "nuxt-headlessui", "nuxt-charts"],
ionic: {
    css: {
      core: true,      // keep required Ionic styles
      basic: false,    // disables normalize/structure/typography
      utilities: false // keep off unless you need Ionic utility classes
    }
  },
  // Recommended for Ionic (especially if targeting iOS/Android)
  ssr: false,
});