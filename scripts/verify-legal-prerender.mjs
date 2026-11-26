/**
 * Confirm the web build put the policy and terms in the prerendered HTML.
 * Run after `npm run build`. Phone builds skip these routes.
 *
 * When NUXT_PUBLIC_SUPPORT_EMAIL is a real address, both pages must include
 * that mailto link. Otherwise both must say that no support email is set.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { SUPPORT_EMAIL_UNSET } from "../utils/supportEmail.js";

const root = resolve(import.meta.dirname, "..");

function findHtml(name) {
  const candidates = [
    `.vercel/output/static/${name}/index.html`,
    `.vercel/output/static/${name}.html`,
    `.output/public/${name}/index.html`,
    `.output/public/${name}.html`,
  ];
  const found = candidates.map((path) => resolve(root, path)).find((path) => existsSync(path));
  return { found, looked: candidates };
}

function missingPhrases(html, phrases) {
  return phrases.filter((phrase) => !html.includes(phrase));
}

const privacyFile = findHtml("privacy");
const termsFile = findHtml("terms");
if (!privacyFile.found || !termsFile.found) {
  console.error("[verify-legal-prerender] Missing prerendered HTML.");
  console.error("  privacy:", privacyFile.found || privacyFile.looked.join(", "));
  console.error("  terms:", termsFile.found || termsFile.looked.join(", "));
  process.exit(1);
}

const privacy = readFileSync(privacyFile.found, "utf8");
const terms = readFileSync(termsFile.found, "utf8");

const privacyRequired = [
  "legal-static-privacy",
  "Privacy policy",
  "Who we are",
  "What we collect",
  "street number, street, city, state, and ZIP code",
  "VIN you type",
  "account number and the account holder",
  "policy number and the policy holder",
  "loan number and the borrower",
  "myfin.investment-holdings.2026-10-31",
  "futurestar.faithPromptDismissed",
  "loginForgotPassword",
  "If you do not see that section or that page",
  "On this device",
];

const termsRequired = [
  "legal-static-terms",
  "Terms of service",
  "Acceptable use",
  "Accounts",
  "Not advice",
  "AI output",
  "Limitation of liability",
  "Governing law",
  "Owner to fill",
  "When the app includes that control",
];

const problems = [];
const privacyMissing = missingPhrases(privacy, privacyRequired);
const termsMissing = missingPhrases(terms, termsRequired);
if (privacyMissing.length) problems.push(`privacy missing: ${privacyMissing.join(" | ")}`);
if (termsMissing.length) problems.push(`terms missing: ${termsMissing.join(" | ")}`);

const email = String(process.env.NUXT_PUBLIC_SUPPORT_EMAIL || "").trim();
const emailIsSet = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
for (const [name, html] of [["privacy", privacy], ["terms", terms]]) {
  if (emailIsSet) {
    if (!html.includes(`mailto:${email}`)) problems.push(`${name} missing mailto:${email}`);
    if (html.includes(SUPPORT_EMAIL_UNSET)) problems.push(`${name} still says no support email is set`);
  } else if (!html.includes(SUPPORT_EMAIL_UNSET)) {
    problems.push(`${name} missing the unset support-email line`);
  }
}

if (problems.length) {
  console.error("[verify-legal-prerender] Served HTML failed:");
  for (const problem of problems) console.error("  " + problem);
  process.exit(1);
}

console.log("[verify-legal-prerender] OK", privacyFile.found, termsFile.found);
