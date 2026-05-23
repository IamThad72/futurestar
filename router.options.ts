import type { RouterConfig } from "@nuxt/schema";

/** Must be a static boolean so Nuxt can tree-shake and apply hash history at build time. */
const hashMode = process.env.NUXT_CAPACITOR === "true";

export default {
  hashMode,
} satisfies RouterConfig;
