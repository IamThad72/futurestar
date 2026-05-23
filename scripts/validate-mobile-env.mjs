/**
 * Fail fast before store builds if required env vars are missing or unsafe.
 * Usage: node scripts/validate-mobile-env.mjs [--dev]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const isDev = process.argv.includes("--dev");
const root = resolve(import.meta.dirname, "..");

function loadDotEnv() {
  const path = resolve(root, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();

const required = ["NUXT_PUBLIC_API_BASE", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"];
const missing = required.filter((k) => !String(process.env[k] ?? "").trim());

if (missing.length) {
  console.error(
    "\n[mobile-env] Missing required variables:\n  " +
      missing.join("\n  ") +
      "\n\nCopy .env.example → .env and set values before building.\n",
  );
  process.exit(1);
}

const apiBase = String(process.env.NUXT_PUBLIC_API_BASE).trim().replace(/\/$/, "");

if (isDev) {
  if (!/^https?:\/\//.test(apiBase)) {
    console.error("[mobile-env] NUXT_PUBLIC_API_BASE must be a valid http(s) URL.");
    process.exit(1);
  }
  console.log("[mobile-env] Dev mobile build OK (NUXT_CAPACITOR + hash routing):", apiBase);
} else {
  if (!apiBase.startsWith("https://")) {
    console.error(
      "[mobile-env] Production mobile builds require HTTPS API base.\n" +
        `  Got: ${apiBase}\n` +
        "  Use CAPACITOR_DEV=true / npm run cap:sync:dev for local emulator HTTP.\n",
    );
    process.exit(1);
  }
  console.log("[mobile-env] Production mobile build OK (NUXT_CAPACITOR + hash routing):", apiBase);
}
