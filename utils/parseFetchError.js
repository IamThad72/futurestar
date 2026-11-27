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

/** HTTP status from an ofetch / $fetch error, or 0 when there isn't one. */
export function fetchStatus(error) {
  const raw =
    error?.statusCode ?? error?.status ?? error?.response?.status ?? error?.data?.statusCode;
  const status = Number(raw);
  return Number.isFinite(status) ? status : 0;
}

/** Anonymous or forbidden responses. Loaders may treat a guest as empty data. */
export function isAuthStatus(error) {
  const status = fetchStatus(error);
  return status === 401 || status === 403;
}

export const SESSION_ENDED_MESSAGE = "Your session ended. Please sign in again.";
export const SIGN_IN_MESSAGE = "Please sign in.";

/**
 * Who the client thinks is signed in. The auth store registers this.
 * Tests can replace it. The default is a first-time guest.
 */
let readSession = () => ({ signedIn: false, ended: false });
let endSession = () => {};

export function bindSessionAuth(reader, ender = () => {}) {
  readSession = typeof reader === "function" ? reader : () => ({ signedIn: false, ended: false });
  endSession = typeof ender === "function" ? ender : () => {};
}

function sessionState() {
  try {
    const state = readSession() || {};
    return { signedIn: Boolean(state.signedIn), ended: Boolean(state.ended) };
  } catch {
    return { signedIn: false, ended: false };
  }
}

/**
 * A 401/403 while the client still had a user is an expired session, not a guest.
 * Returns true when this request should say the session ended.
 */
export function markSessionEnded() {
  const state = sessionState();
  if (state.signedIn) {
    try {
      endSession();
    } catch {
      /* the store clears itself */
    }
    return true;
  }
  return state.ended;
}

/**
 * Loaders only. A first-time guest becomes empty data.
 * An expired session keeps a message so the page does not look blank on purpose.
 */
export function settleLoadError(error, fallback = "Something went wrong. Please try again.") {
  if (isAuthStatus(error)) {
    const expired = markSessionEnded();
    return {
      auth: true,
      expired,
      message: expired ? SESSION_ENDED_MESSAGE : "",
    };
  }
  return { auth: false, expired: false, message: parseFetchError(error, fallback) };
}

/**
 * Map $fetch / network errors to user-facing messages.
 * Mutations use this. 401/403 always return a sentence, never an empty string.
 */
export function parseFetchError(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;
  if (isAuthStatus(error)) {
    return markSessionEnded() ? SESSION_ENDED_MESSAGE : SIGN_IN_MESSAGE;
  }

  const status = fetchStatus(error);

  const raw = messageCandidates(error).map((value) => String(value ?? "")).join(" ");
  const msg = usefulServerMessage(error);

  const causeCode = error?.cause?.code ?? error?.code;
  const isNetworkMessage =
    /failed to fetch|network error|load failed|networkrequestfailed|fetch failed/i.test(raw);

  // Prefer HTTP status handling before treating FetchError as a network outage.
  // (ofetch uses FetchError for 4xx/5xx as well as true connectivity failures.)
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
