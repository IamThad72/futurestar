import { GENERAL_CONTACT_EMAIL, resolveSupportEmail } from "./supportEmail.js";

/** Phrases that must be in the served HTML whether or not Owner to fill notes remain. */
export const PRIVACY_CONTENT = [
  "legal-static-privacy",
  "Privacy policy",
  "Who we are",
  "What we collect",
  "How we use it",
  "street number, street, city, state, and ZIP code",
  "VIN you type",
  "account number and the account holder",
  "policy number and the policy holder",
  "loan number and the borrower",
  "myfin.investment-holdings.2026-10-31",
  "futurestar.faithPromptDismissed",
  "loginForgotPassword",
  "If you do not see that section or that page",
  "90 days",
  "not visible or accessible in the app",
  "(former member)",
  "Household tax profiles and deduction overrides stay",
  "queued for deletion",
  "On this device",
  "We do not sell personal information",
  "cross-context behavioral advertising",
  "14 or older",
  "children under 14",
];

export const TERMS_CONTENT = [
  "legal-static-terms",
  "Terms of service",
  "Acceptable use",
  "Accounts",
  "Not advice",
  "AI output",
  "Limitation of liability",
  "Governing law",
  "When the app includes that control",
  "90 days",
  "not visible or accessible in the app",
  "Sample text for the owner's review",
  "as is",
  "$100",
  "Wayne County, Ohio",
  "Northern District of Ohio",
  "14 or older",
];

function missingPhrases(html, phrases) {
  return phrases.filter((phrase) => !html.includes(phrase));
}

/**
 * Check prerendered privacy and terms HTML.
 * Owner to fill notes are required only while expectPlaceholders is true.
 */
export function checkLegalHtml(privacy, terms, options = {}) {
  const support = resolveSupportEmail(options.supportEmail);
  const expectPlaceholders = Boolean(options.expectPlaceholders);
  const problems = [];
  const privacyMissing = missingPhrases(privacy, PRIVACY_CONTENT);
  const termsMissing = missingPhrases(terms, TERMS_CONTENT);
  if (privacyMissing.length) problems.push(`privacy missing: ${privacyMissing.join(" | ")}`);
  if (termsMissing.length) problems.push(`terms missing: ${termsMissing.join(" | ")}`);

  for (const [name, html] of [["privacy", privacy], ["terms", terms]]) {
    if (!html.includes(`mailto:${support}`)) problems.push(`${name} missing mailto:${support}`);
    if (!html.includes(`mailto:${GENERAL_CONTACT_EMAIL}`)) {
      problems.push(`${name} missing mailto:${GENERAL_CONTACT_EMAIL}`);
    }
    const hasPlaceholder = html.includes("Owner to fill");
    if (expectPlaceholders && !hasPlaceholder) problems.push(`${name} missing Owner to fill`);
    if (!expectPlaceholders && hasPlaceholder) problems.push(`${name} still has Owner to fill`);
  }
  return problems;
}
