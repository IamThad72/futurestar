/**
 * Pure checks for account deletion. No database and no network.
 * REAUTH_WINDOW_MS and the attempt limits live in accountDeletionPolicy.js.
 */

export function deletionAttemptBlocked(userFailures, ipFailures, limits = {}) {
  const userLimit = limits.userLimit ?? 5;
  const ipLimit = limits.ipLimit ?? 30;
  return Number(userFailures) >= userLimit || Number(ipFailures) >= ipLimit;
}

/** Only the public deletion page may be used as a post-login return path. */
export function safeDeleteAccountNext(value) {
  return value === "/delete-account" ? "/delete-account" : "";
}

export function deletionDialogDismissAllowed(busy) {
  return busy !== true;
}

/** Tab cycle inside a dialog. Returns the next index, wrapping at the ends. */
export function nextDialogFocusIndex(currentIndex, count, shiftKey) {
  if (count <= 0) return 0;
  const index = Number(currentIndex);
  if (shiftKey && index <= 0) return count - 1;
  if (!shiftKey && index >= count - 1) return 0;
  return index + (shiftKey ? -1 : 1);
}

function decodeBase64Url(value) {
  const padded = String(value).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(value).length + 3) % 4);
  if (typeof Buffer !== "undefined") return Buffer.from(padded, "base64").toString("utf8");
  return atob(padded);
}

/**
 * True when a bearer token's iat is within windowMs of now (30s of future skew allowed).
 * A missing or unreadable iat is not fresh.
 */
export function bearerIsFresh(token, nowMs, windowMs) {
  const parts = String(token ?? "").split(".");
  if (parts.length < 2 || !parts[1]) return false;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    const iat = Number(payload.iat);
    if (!Number.isFinite(iat)) return false;
    const age = Number(nowMs) - iat * 1000;
    return age >= -30_000 && age <= Number(windowMs);
  } catch {
    return false;
  }
}
