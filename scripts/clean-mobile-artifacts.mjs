/**
 * Remove generated web and native build artifacts before a fresh Capacitor sync.
 * Does not delete android/ or ios/ project trees (only build outputs inside them).
 */
import { existsSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");

const removeDirs = [
  "dist",
  ".nuxt",
  ".output",
  join("android", "app", "build"),
  join("android", "build"),
  join("android", "capacitor-cordova-android-plugins", "build"),
  join("ios", "App", "DerivedData"),
  join("ios", "App", "build"),
];

for (const rel of removeDirs) {
  const abs = resolve(root, rel);
  if (!existsSync(abs)) continue;
  rmSync(abs, { recursive: true, force: true });
  console.log(`[cap:clean] removed ${rel}/`);
}

const gradlew = resolve(root, "android", process.platform === "win32" ? "gradlew.bat" : "gradlew");
if (existsSync(gradlew)) {
  try {
    execSync(`${gradlew} clean`, { cwd: resolve(root, "android"), stdio: "inherit" });
  } catch {
    console.warn("[cap:clean] gradlew clean skipped (Android SDK or project not ready)");
  }
}

console.log("[cap:clean] Done — run cap:deploy:prod or cap:sync next.");
