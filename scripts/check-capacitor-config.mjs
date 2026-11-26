/**
 * Load capacitor.config.ts the way @capacitor/cli does (`cap config`).
 * TypeScript 7 does not export transpileModule or ModuleKind, and the CLI
 * crashes while reading the config. This must keep passing in CI.
 */
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["cap", "config", "--json"], {
  encoding: "utf8",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

let cfg;
try {
  cfg = JSON.parse(result.stdout);
} catch {
  console.error("npx cap config --json did not print JSON.");
  console.error(result.stdout);
  process.exit(1);
}

const appId = cfg.app?.appId;
const webDir = cfg.app?.webDir;
const extConfigType = cfg.app?.extConfigType;
const androidScheme = cfg.app?.extConfig?.server?.androidScheme;

if (appId !== "com.futurestar.myfin" || webDir !== "dist" || extConfigType !== "ts" || androidScheme !== "https") {
  console.error("Capacitor config did not load capacitor.config.ts.", {
    appId,
    webDir,
    extConfigType,
    androidScheme,
  });
  process.exit(1);
}

console.log(`Capacitor config loaded from capacitor.config.ts (${appId}, webDir ${webDir}).`);
