function trimText(value) {
  return String(value ?? "").trim();
}

/**
 * Plain-text copy for an in-app confirm. Trims each field and fills in a
 * header and button labels when the caller leaves them blank.
 */
export function buildConfirmCopy(options = {}) {
  const header = trimText(options.header);
  const message = trimText(options.message);
  return {
    header: header || "Please confirm",
    message,
    confirmText: trimText(options.confirmText) || "OK",
    cancelText: trimText(options.cancelText) || "Cancel",
  };
}
