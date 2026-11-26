import { originPermitted } from "../utils/cors";

/**
 * CORS for Capacitor WebViews and deployed web app calling the API on another origin.
 * Native apps send Authorization: Bearer (not cookies) — no credentials mode required.
 * Entries are exact origins (scheme, host, and port). `http://localhost` is port 80.
 * The dev server's port is listed on its own so it is not a prefix match.
 */
const CAPACITOR_ORIGINS = [
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "http://localhost:3000",
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
  const permit = originPermitted(origin, allowed);

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
