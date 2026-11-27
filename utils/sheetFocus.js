/**
 * The ion-item that opened a You sheet. Focus goes to its inner native button
 * (one tab stop). ion-item.setFocus is the fallback when the shadow button
 * is not there yet.
 */
let pendingTrigger = null;

export function rememberSheetTrigger(el) {
  pendingTrigger = el ?? null;
}

export function consumeSheetTrigger(activeElement, body) {
  const trigger = pendingTrigger;
  pendingTrigger = null;
  return sheetReturnTarget(trigger, activeElement, body);
}

export function sheetReturnTarget(trigger, activeElement, body) {
  if (isElement(trigger, body)) return trigger;
  if (isElement(activeElement, body)) return activeElement;
  return null;
}

/** Focus the row's inner button, or call ion-item setFocus. Returns what was focused. */
export function focusSheetControl(host) {
  const button = host?.shadowRoot?.querySelector?.("button");
  if (button && typeof button.focus === "function") {
    button.focus();
    return button;
  }
  if (host && typeof host.setFocus === "function") {
    host.setFocus();
    return host;
  }
  return null;
}

function isElement(el, body) {
  return Boolean(
    el &&
      el !== body &&
      (el.shadowRoot || typeof el.setFocus === "function" || typeof el.focus === "function"),
  );
}
