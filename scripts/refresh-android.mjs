/**
 * Uninstall app from emulator/device, rebuild web bundle, sync, and run.
 * Use when UI/navigation looks stale after cap:sync:dev.
 */
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

try {
  execSync("adb uninstall com.futurestar.myfin", { stdio: "inherit", cwd: root });
} catch {
  console.warn("[cap:refresh:android] adb uninstall skipped (no device or app not installed)");
}

execSync("npm run cap:run:android", { stdio: "inherit", cwd: root });
