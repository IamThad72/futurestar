/**
 * Confirm the web build put the policy and terms in the prerendered HTML.
 * Run after `npm run build`. Phone builds skip these routes.
 *
 * Owner to fill notes are required only while a placeholder remains in the
 * legal text. LEGAL_DRAFT stays a production-build guard and does not, by
 * itself, require those words in the HTML. Section headings, disclosures,
 * deletion wording, liability, governing law, and the support email are
 * always required.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { checkLegalHtml } from "../utils/legalHtmlCheck.js";
import { legalPlaceholdersRemain } from "../utils/legalDraftGuard.js";

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
const problems = checkLegalHtml(privacy, terms, {
  supportEmail: process.env.NUXT_PUBLIC_SUPPORT_EMAIL || "",
  expectPlaceholders: legalPlaceholdersRemain(),
});

if (problems.length) {
  console.error("[verify-legal-prerender] Served HTML failed:");
  for (const problem of problems) console.error("  " + problem);
  process.exit(1);
}

console.log("[verify-legal-prerender] OK", privacyFile.found, termsFile.found);
