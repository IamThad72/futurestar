import { LEGAL_DRAFT, LEGAL_UPDATED, legalUpdatedLabel } from "./legalText.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderParts(parts) {
  return (parts || [])
    .map((part) => {
      if (part && typeof part === "object" && part.href) {
        return `<a href="${escapeHtml(part.href)}">${escapeHtml(part.label)}</a>`;
      }
      return escapeHtml(part);
    })
    .join("");
}

function renderBlock(block) {
  if (!block || typeof block !== "object") return "";
  if (block.type === "h3") return `<h3>${escapeHtml(block.text)}</h3>`;
  if (block.type === "ul") {
    const items = (block.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    return `<ul>${items}</ul>`;
  }
  if (block.type === "placeholder") {
    return `<p><strong>Owner to fill.</strong> ${escapeHtml(block.text)}</p>`;
  }
  if (block.type === "supportEmail") {
    return "<p>No support email is set. The owner adds one with NUXT_PUBLIC_SUPPORT_EMAIL. This page leaves the address out until then.</p>";
  }
  if (block.type === "p") {
    const inner = block.parts ? renderParts(block.parts) : escapeHtml(block.text);
    return `<p>${inner}</p>`;
  }
  return "";
}

/** HTML for /privacy and /terms that is present before JavaScript runs. */
export function legalStaticHtml(document) {
  const marker = `legal-static-${document.id}`;
  const draft = LEGAL_DRAFT
    ? "<p><strong>Draft.</strong> This text is not approved. It needs the owner's review before it can be published.</p>"
    : "";
  const sections = (document.sections || [])
    .map((section) => {
      const blocks = (section.blocks || []).map(renderBlock).join("");
      return `<section><h2 id="${escapeHtml(section.id)}">${escapeHtml(section.heading)}</h2>${blocks}</section>`;
    })
    .join("");
  return `<noscript><article id="${marker}">${draft}<h1>${escapeHtml(document.title)}</h1><p>Last updated ${escapeHtml(legalUpdatedLabel(LEGAL_UPDATED))}</p>${sections}</article></noscript>`;
}
