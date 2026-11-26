import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [
    {
      name: "nuxt-server-auto-imports",
      enforce: "pre",
      transform(code, id) {
        const file = id.split("?")[0] ?? id;
        if (!file.includes("/server/") || !file.endsWith(".ts")) return null;
        if (!/\bdefineEventHandler\b/.test(code)) return null;
        if (/import\s+[^;]*\bdefineEventHandler\b/.test(code)) return null;
        return `import { defineEventHandler } from "h3";\n${code}`;
      },
    },
  ],
  resolve: {
    alias: {
      "~": root,
      "@": root,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup-env.ts"],
  },
});
