export type ParsedOrigin = {
  scheme: string;
  host: string;
  port: string;
};

function defaultPort(scheme: string) {
  if (scheme === "http") return "80";
  if (scheme === "https") return "443";
  return "";
}

/**
 * An allow-list entry or request Origin, reduced to scheme, host, and port.
 * A path, query, hash, or userinfo means it is not an origin.
 * http and https with no port use 80 and 443.
 */
export function parseOrigin(value: string): ParsedOrigin | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;
  if (url.search || url.hash) return null;
  const scheme = url.protocol.replace(/:$/, "").toLowerCase();
  const host = url.hostname.toLowerCase();
  if (!scheme || !host) return null;
  return { scheme, host, port: url.port || defaultPort(scheme) };
}

function sameOrigin(left: ParsedOrigin, right: ParsedOrigin) {
  return left.scheme === right.scheme && left.host === right.host && left.port === right.port;
}

/**
 * True when the request Origin is exactly one allow-list entry.
 * `http://localhost` does not allow `http://localhost.evil.com` or another port.
 * An allow-list that contains `*` allows any Origin, matching the previous wildcard.
 */
export function originPermitted(origin: string | null | undefined, allowed: readonly string[]) {
  if (allowed.includes("*")) return Boolean(origin);
  if (!origin) return false;
  const request = parseOrigin(origin);
  if (!request) return false;
  return allowed.some((entry) => {
    const item = parseOrigin(entry);
    return item !== null && sameOrigin(request, item);
  });
}
