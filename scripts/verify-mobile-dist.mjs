/**
 * Fail if dist/ was not produced by a Capacitor mobile build (hash routing + marker).
 * Run automatically after build:mobile:dev / build:mobile:prod.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const distDir = resolve(root, "dist");
const markerPath = resolve(distDir, ".capacitor-hash-build.json");

if (!existsSync(distDir)) {
  console.error("\n[verify-mobile-dist] dist/ not found. Run nuxt generate first.\n");
  process.exit(1);
}

if (!existsSync(markerPath)) {
  console.error(
    "\n[verify-mobile-dist] Missing dist/.capacitor-hash-build.json\n" +
      "  This dist/ was not built with NUXT_CAPACITOR=true.\n" +
      "  Use: npm run build:mobile:dev  or  npm run build:mobile:prod\n" +
      "  Do not use plain `nuxt generate` or `npm run build:mobile` for Capacitor.\n",
  );
  process.exit(1);
}

let marker;
try {
  marker = JSON.parse(readFileSync(markerPath, "utf8"));
} catch {
  console.error("[verify-mobile-dist] Invalid marker file:", markerPath);
  process.exit(1);
}

if (!marker.hashMode) {
  console.error("[verify-mobile-dist] Marker says hashMode is off — Capacitor builds require hash routing.");
  process.exit(1);
}

const indexPath = resolve(distDir, "index.html");
if (!existsSync(indexPath)) {
  console.error("[verify-mobile-dist] dist/index.html missing.");
  process.exit(1);
}

const indexHtml = readFileSync(indexPath, "utf8");
if (!/isCapacitorBuild["']?\s*:\s*true/.test(indexHtml)) {
  console.error(
    "\n[verify-mobile-dist] index.html is missing runtimeConfig.public.isCapacitorBuild.\n" +
      "  Rebuild with NUXT_CAPACITOR=true (npm run build:mobile:dev or build:mobile:prod).\n",
  );
  process.exit(1);
}

const nuxtDir = resolve(distDir, "_nuxt");
if (!existsSync(nuxtDir)) {
  console.error("[verify-mobile-dist] dist/_nuxt/ missing.");
  process.exit(1);
}

const jsFiles = readdirSync(nuxtDir).filter((f) => f.endsWith(".js"));
if (jsFiles.length === 0) {
  console.error("[verify-mobile-dist] No JS chunks in dist/_nuxt/.");
  process.exit(1);
}

const allowedTopLevel = new Set([
  "_nuxt",
  "200.html",
  "404.html",
  "favicon.ico",
  "index.html",
  "manifest.webmanifest",
  "robots.txt",
  ".capacitor-hash-build.json",
]);

const routeFolders = readdirSync(distDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !allowedTopLevel.has(e.name))
  .map((e) => e.name);

if (routeFolders.length > 0) {
  console.error(
    "\n[verify-mobile-dist] History-mode prerender detected (hash mode is OFF).\n" +
      `  Found route folders: ${routeFolders.join(", ")}\n` +
      "  Capacitor needs hash routing — only index.html + _nuxt/ should exist.\n" +
      "  Re-run: npm run build:mobile:dev\n",
  );
  process.exit(1);
}

console.log(
  `[verify-mobile-dist] OK — hash Capacitor build (${marker.mode ?? "unknown"}) at ${marker.builtAt ?? "unknown time"}`,
);
