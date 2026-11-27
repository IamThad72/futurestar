import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { legalPlaceholdersRemain, legalReleaseBlocked, legalTextStillDraft, ownerToFillExpected } from "../utils/legalDraftGuard.js";
import { checkLegalHtml } from "../utils/legalHtmlCheck.js";
import { legalStaticHtml } from "../utils/legalStaticHtml.js";
import { privacyPolicy, termsOfService } from "../utils/legalText.js";
import { DEFAULT_SUPPORT_EMAIL, supportEmailInnerHtml } from "../utils/supportEmail.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

function withoutPlaceholders(document) {
  return {
    ...document,
    sections: document.sections.map((section) => ({
      ...section,
      blocks: (section.blocks || []).filter((block) => block.type !== "placeholder"),
    })),
  };
}

test("draft HTML keeps Owner to fill notes and the required sections", () => {
  const privacy = legalStaticHtml(privacyPolicy);
  const terms = legalStaticHtml(termsOfService);
  assert.equal(ownerToFillExpected(), true);
  assert.equal(legalPlaceholdersRemain(), true);
  assert.deepEqual(checkLegalHtml(privacy, terms, { expectPlaceholders: true }), []);
  assert.match(privacy, /mailto:support@me.com/);
  assert.match(terms, /mailto:info@me.com/);
  assert.equal(privacy.includes('href="/delete-account"'), false);
  assert.equal(terms.includes('href="/delete-account"'), false);
  assert.match(privacy, /kept hidden for 90 days, then a daily job permanently deletes them/);
  assert.match(privacy, /not visible or accessible in the app/);
  assert.match(privacy, /\(former member\)/);
  assert.match(terms, /kept hidden for 90 days, then a daily job permanently deletes them/);
  assert.equal(terms.includes("A daily job then deletes them."), false);
  assert.equal(privacy.includes("Money rows that were never shared"), false);
  assert.equal(privacy.includes("A share you granted"), false);

  const overridden = legalStaticHtml(privacyPolicy, "owner@example.com");
  assert.match(overridden, /href="mailto:owner@example.com"/);
  assert.equal(overridden.includes(`mailto:${DEFAULT_SUPPORT_EMAIL}`), false);
  assert.match(supportEmailInnerHtml(""), new RegExp(`mailto:${DEFAULT_SUPPORT_EMAIL}`));
  assert.match(supportEmailInnerHtml("not-an-email"), new RegExp(`mailto:${DEFAULT_SUPPORT_EMAIL}`));
  const page = read("components/LegalDocument.vue");
  assert.match(page, /supportEmailInnerHtml/);
});

test("filled HTML drops Owner to fill and still checks the real sections", () => {
  const filledPrivacy = withoutPlaceholders(privacyPolicy);
  const filledTerms = withoutPlaceholders(termsOfService);
  assert.equal(legalPlaceholdersRemain([filledPrivacy, filledTerms]), false);
  assert.equal(ownerToFillExpected([filledPrivacy, filledTerms], false), false);
  assert.equal(ownerToFillExpected([filledPrivacy, filledTerms], true), true);
  const privacy = legalStaticHtml(filledPrivacy, "owner@example.com");
  const terms = legalStaticHtml(filledTerms, "owner@example.com");
  assert.equal(privacy.includes("Owner to fill"), false);
  assert.equal(terms.includes("Owner to fill"), false);
  assert.deepEqual(
    checkLegalHtml(privacy, terms, { supportEmail: "owner@example.com", expectPlaceholders: false }),
    [],
  );
  assert.match(terms, /Limitation of liability/);
  assert.match(terms, /Wayne County, Ohio/);
  assert.match(privacy, /We do not sell personal information/);
});

test("the web build prerenders privacy and terms, and the phone build does not", () => {
  const config = read("nuxt.config.ts");
  assert.match(config, /assertLegalReleaseAllowed\(\)/);
  assert.match(config, /"\/privacy": \{ ssr: true, prerender: true \}/);
  assert.match(config, /"\/terms": \{ ssr: true, prerender: true \}/);
  assert.match(config, /routes: isCapacitorBuild \? \["\/"\] : \["\/privacy", "\/terms", "\/delete-account"\]/);
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
