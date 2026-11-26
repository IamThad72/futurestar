import { legalStaticHtml } from "~/utils/legalStaticHtml.js";
import { privacyPolicy, termsOfService } from "~/utils/legalText.js";

function documentForPath(path: string | undefined) {
  const bare = String(path ?? "").split("?")[0].replace(/\/$/, "") || "/";
  if (bare === "/privacy") return privacyPolicy;
  if (bare === "/terms") return termsOfService;
  return null;
}

function bakedSupportEmail() {
  const fromEnv = String(process.env.NUXT_PUBLIC_SUPPORT_EMAIL || "");
  try {
    const config = useRuntimeConfig();
    return String(config.public?.supportEmail || fromEnv);
  } catch {
    return fromEnv;
  }
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("render:html", (html, { event }) => {
    const document = documentForPath(event.path);
    if (!document) return;
    const marker = `legal-static-${document.id}`;
    if (html.bodyPrepend.some((chunk) => String(chunk).includes(marker))) return;
    html.bodyPrepend.push(legalStaticHtml(document, bakedSupportEmail()));
  });

  nitroApp.hooks.hook("prerender:generate", (route) => {
    const document = documentForPath(route.route);
    if (!document || !route.contents) return;
    const marker = `legal-static-${document.id}`;
    if (route.contents.includes(marker)) return;
    route.contents = route.contents.replace(
      "<body>",
      `<body>${legalStaticHtml(document, bakedSupportEmail())}`,
    );
  });
});
