const GENERIC_SERVER_STATUS =
  /^(?:bad gateway|service unavailable|internal server error|server error|error|request error)$/i;

/** ofetch's FetchError message is `[METHOD] "url": 503 Service Unavailable`. */
function unwrapFetchMessage(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "[object Object]") return "";
  const match = text.match(/^\[[A-Z]+\]\s+".*?":\s+\d{3}(?:\s+([\s\S]*))?$/);
  return (match ? match[1] || "" : text).trim();
}

function messageCandidates(error) {
  const data = error?.data;
  const nested = data && typeof data === "object" ? data.data : undefined;
  return [
    data?.statusMessage,
    data?.message,
    nested?.statusMessage,
    nested?.message,
    error?.statusMessage,
    error?.message,
  ];
}

/** First human sentence, skipping standard HTTP reason phrases and raw fetch wrappers. */
function usefulServerMessage(error) {
  for (const candidate of messageCandidates(error)) {
    const text = unwrapFetchMessage(candidate);
    if (!text || GENERIC_SERVER_STATUS.test(text)) continue;
    return text;
  }
  return "";
}

/**
 * Map $fetch / network errors to user-facing messages.
 */
export function parseFetchError(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;

  const status =
    error?.statusCode ?? error?.status ?? error?.response?.status ?? error?.data?.statusCode;

  const raw = messageCandidates(error).map((value) => String(value ?? "")).join(" ");
  const msg = usefulServerMessage(error);

  const causeCode = error?.cause?.code ?? error?.code;
  const isNetworkMessage =
    /failed to fetch|network error|load failed|networkrequestfailed|fetch failed/i.test(raw);

  // Prefer HTTP status handling before treating FetchError as a network outage.
  // (ofetch uses FetchError for 4xx/5xx as well as true connectivity failures.)
  if (status === 401 || status === 403) {
    return msg || "Your session may have expired. Please sign in again.";
  }

  if (status === 404) {
    return msg || "The requested resource was not found.";
  }

  if (typeof status === "number" && status >= 500) {
    if (msg) return msg;
    if (fallback !== "Something went wrong. Please try again.") return fallback;
    return "The server had a problem. Please try again in a moment.";
  }

  if (
    (!status && error?.name === "FetchError") ||
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

  if (/timeout|timed out|aborted/i.test(raw) || error?.name === "AbortError") {
    return "The request timed out. Check your connection and try again.";
  }

  return msg || fallback;
}
