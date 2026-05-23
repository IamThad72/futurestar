/**
 * CORS for Capacitor WebViews and deployed web app calling the API on another origin.
 * Native apps send Authorization: Bearer (not cookies) — no credentials mode required.
 */
const CAPACITOR_ORIGINS = [
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
];

function allowedOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const site = process.env.NUXT_PUBLIC_SITE_URL?.trim();
  const extras = site ? [site] : [];
  return [...new Set([...CAPACITOR_ORIGINS, ...fromEnv, ...extras])];
}

export default defineEventHandler((event) => {
  const origin = getRequestHeader(event, "origin");
  const allowed = allowedOrigins();
  const permit =
    allowed.includes("*") ||
    (origin && allowed.some((o) => o === origin || origin.startsWith(o)));

  if (permit && origin) {
    setResponseHeaders(event, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    });
  } else if (allowed.includes("*")) {
    setResponseHeaders(event, { "Access-Control-Allow-Origin": "*" });
  }

  if (event.method === "OPTIONS") {
    return sendNoContent(event, 204);
  }
});
