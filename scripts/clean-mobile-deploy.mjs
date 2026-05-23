/**
 * Clean artifacts, production mobile build, and cap sync (Android + iOS web bundle).
 * Requires HTTPS NUXT_PUBLIC_API_BASE (see validate-mobile-env.mjs).
 *
 * Override for one-off deploy without editing .env:
 *   NUXT_PUBLIC_API_BASE=https://api.example.com npm run cap:deploy:prod
 */
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

execSync("node scripts/clean-mobile-artifacts.mjs", { stdio: "inherit", cwd: root });
execSync("npm run build:mobile:prod", { stdio: "inherit", cwd: root, env: process.env });
execSync("npx cap sync", { stdio: "inherit", cwd: root, env: process.env });

console.log(
  "\n[cap:deploy:prod] Web bundle synced to android/ and ios/.\n" +
    "  Android: npm run cap:android → Build → Generate Signed Bundle/APK\n" +
    "  iOS (macOS): npm run cap:ios → Product → Archive\n",
);
