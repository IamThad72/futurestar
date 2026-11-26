import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { legalReleaseBlocked, legalTextStillDraft } from "../utils/legalDraftGuard.js";
import { legalStaticHtml } from "../utils/legalStaticHtml.js";
import { privacyPolicy, termsOfService } from "../utils/legalText.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("privacy and terms HTML is in the page before JavaScript runs", () => {
  const privacy = legalStaticHtml(privacyPolicy);
  const terms = legalStaticHtml(termsOfService);
  assert.match(privacy, /<noscript><article id="legal-static-privacy">/);
  assert.match(terms, /<noscript><article id="legal-static-terms">/);
  assert.match(privacy, /street number, street, city, state, and ZIP code/);
  assert.match(privacy, /VIN you type/);
  assert.match(privacy, /account number and the account holder/);
  assert.match(privacy, /policy number and the policy holder/);
  assert.match(privacy, /loan number and the borrower/);
  assert.match(privacy, /myfin\.investment-holdings\.2026-10-31/);
  assert.match(privacy, /futurestar\.faithPromptDismissed/);
  assert.match(privacy, /loginForgotPassword/);
  assert.match(privacy, /If you do not see that section or that page/);
  assert.equal(privacy.includes('href="/delete-account"'), false);
  assert.match(terms, /Limitation of liability/);
  assert.match(terms, /Owner to fill/);
  assert.equal(terms.includes('href="/delete-account"'), false);
});

test("the web build prerenders privacy and terms, and the phone build does not", () => {
  const config = read("nuxt.config.ts");
  assert.match(config, /assertLegalReleaseAllowed\(\)/);
  assert.match(config, /"\/privacy": \{ ssr: true, prerender: true \}/);
  assert.match(config, /"\/terms": \{ ssr: true, prerender: true \}/);
  assert.match(config, /routes: isCapacitorBuild \? \["\/"\] : \["\/privacy", "\/terms"\]/);
  const plugin = read("server/plugins/legal-html.ts");
  assert.match(plugin, /legal-static-/);
  assert.match(plugin, /prerender:generate/);
  const envPlugin = read("server/plugins/env-validation.ts");
  assert.match(envPlugin, /if \(import\.meta\.prerender\) return;/);
});

test("a draft blocks production and main, and does not block preview or this pull request", () => {
  assert.equal(legalTextStillDraft(), true);
  assert.equal(legalReleaseBlocked({}), false);
  assert.equal(legalReleaseBlocked({ VERCEL_ENV: "preview" }), false);
  assert.equal(legalReleaseBlocked({ VERCEL_ENV: "preview", GITHUB_REF: "refs/heads/main" }), false);
  assert.equal(legalReleaseBlocked({ VERCEL_ENV: "development", GITHUB_REF: "refs/heads/main" }), false);
  assert.equal(legalReleaseBlocked({ GITHUB_REF: "refs/pull/14/merge" }), false);
  assert.equal(legalReleaseBlocked({ NODE_ENV: "production" }), false);
  assert.equal(legalReleaseBlocked({ VERCEL_ENV: "production" }), true);
  assert.equal(legalReleaseBlocked({ GITHUB_REF: "refs/heads/main" }), true);
  assert.equal(legalReleaseBlocked(process.env), false);
});
