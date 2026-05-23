import { Capacitor } from "@capacitor/core";

/** Backend origin for Capacitor (from NUXT_PUBLIC_API_BASE at build time). */
export function getNativeApiBase(apiBase: unknown): string {
  const base = typeof apiBase === "string" ? apiBase.trim().replace(/\/$/, "") : "";
  if (!import.meta.client || !base || !Capacitor.isNativePlatform()) {
    return "";
  }
  return base;
}

/** True for `/api/...` paths (only these may be sent to NUXT_PUBLIC_API_BASE). */
export function isApiPath(url: string): boolean {
  if (!url) return false;
  try {
    const path = url.startsWith("http://") || url.startsWith("https://")
      ? new URL(url).pathname
      : url.split("?")[0] ?? url;
    return path === "/api" || path.startsWith("/api/");
  } catch {
    return url.startsWith("/api/");
  }
}

/** Turn `/api/...` into `https://host/api/...` on native when apiBase is set. */
export function resolveNativeApiUrl(url: string, apiBase: unknown): string {
  const base = getNativeApiBase(apiBase);
  if (!base || !isApiPath(url)) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${base}${url}`;
  return url;
}
