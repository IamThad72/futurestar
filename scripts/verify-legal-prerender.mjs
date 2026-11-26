/**
 * Confirm the web build put the policy text in the prerendered HTML.
 * Run after `npm run build`. Phone builds skip these routes.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const candidates = [
  ".vercel/output/static/privacy/index.html",
  ".vercel/output/static/privacy.html",
  ".output/public/privacy/index.html",
  ".output/public/privacy.html",
];

const privacyPath = candidates.map((path) => resolve(root, path)).find((path) => existsSync(path));
if (!privacyPath) {
  console.error("[verify-legal-prerender] No prerendered /privacy HTML. Looked in:\n  " + candidates.join("\n  "));
  process.exit(1);
}

const termsPath = privacyPath.replace("privacy", "terms");
const privacy = readFileSync(privacyPath, "utf8");
const terms = existsSync(termsPath) ? readFileSync(termsPath, "utf8") : "";

const required = [
  "legal-static-privacy",
  "street number, street, city, state, and ZIP code",
  "VIN you type",
  "account number and the account holder",
  "myfin.investment-holdings.2026-10-31",
  "futurestar.faithPromptDismissed",
  "loginForgotPassword",
  "If you do not see that section or that page",
];

const missing = required.filter((phrase) => !privacy.includes(phrase));
if (missing.length || !terms.includes("legal-static-terms")) {
  console.error("[verify-legal-prerender] Served HTML is missing:", missing, "terms marker", terms.includes("legal-static-terms"));
  process.exit(1);
}

console.log("[verify-legal-prerender] OK", privacyPath);
