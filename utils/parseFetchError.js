/**
 * Map $fetch / network errors to user-facing messages.
 */
export function parseFetchError(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;

  const status =
    error?.statusCode ?? error?.status ?? error?.response?.status ?? error?.data?.statusCode;

  const msg = String(
    error?.data?.statusMessage ?? error?.data?.message ?? error?.message ?? "",
  ).trim();

  const causeCode = error?.cause?.code ?? error?.code;
  const isNetworkMessage =
    /failed to fetch|network error|load failed|networkrequestfailed|fetch failed/i.test(msg);

  if (
    error?.name === "FetchError" ||
    isNetworkMessage ||
    causeCode === "ECONNREFUSED" ||
    causeCode === "ENOTFOUND" ||
    causeCode === "ECONNRESET"
  ) {
    if (import.meta.client && typeof navigator !== "undefined" && !navigator.onLine) {
      return "You appear to be offline. Check your connection and try again.";
    }
    return "Can't reach the server. Check your internet connection and try again.";
  }

  if (/timeout|timed out|aborted/i.test(msg) || error?.name === "AbortError") {
    return "The request timed out. Check your connection and try again.";
  }

  if (status === 401 || status === 403) {
    return msg || "Your session may have expired. Please sign in again.";
  }

  if (status === 404) {
    return msg || "The requested resource was not found.";
  }

  if (typeof status === "number" && status >= 500) {
    return msg || "The server had a problem. Please try again in a moment.";
  }

  return msg || fallback;
}
