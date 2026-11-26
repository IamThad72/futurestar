import { LEGAL_DRAFT, legalDocuments } from "./legalText.js";

/**
 * Production deploys and builds of main must not ship a draft policy.
 * Preview builds and pull-request CI do not set these, so this PR stays green.
 * VERCEL_ENV=production is the Vercel production deploy.
 * GITHUB_REF=refs/heads/main is a GitHub Actions run on main.
 * NODE_ENV=production is not a gate: `nuxt build` sets it for preview and CI too.
 */
export function isProductionRelease(env = process.env) {
  // A Vercel preview must build even if the project also has GITHUB_REF set.
  if (env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development") return false;
  if (env.VERCEL_ENV === "production") return true;
  return env.GITHUB_REF === "refs/heads/main";
}

export function legalTextStillDraft(documents = legalDocuments) {
  if (LEGAL_DRAFT) return true;
  for (const document of documents || []) {
    for (const section of document.sections || []) {
      for (const block of section.blocks || []) {
        if (block?.type === "placeholder") return true;
        const text = `${block?.text || ""} ${JSON.stringify(block?.parts || "")}`;
        if (text.includes("Owner to fill")) return true;
      }
    }
  }
  return false;
}

export function legalReleaseBlocked(env = process.env) {
  return isProductionRelease(env) && legalTextStillDraft();
}

export function assertLegalReleaseAllowed(env = process.env) {
  if (!legalReleaseBlocked(env)) return;
  throw new Error(
    "Future Star legal text is still a draft. Set LEGAL_DRAFT to false and remove the Owner to fill placeholders before a production deploy or a build on main.",
  );
}
