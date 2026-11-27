/**
 * The control that opened a You sheet, then whatever else is focused, as long
 * as it is not the page body. ion-modal moves focus into the sheet and the
 * sheet puts it back here after dismiss.
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
  if (isFocusable(trigger, body)) return trigger;
  if (isFocusable(activeElement, body)) return activeElement;
  return null;
}

function isFocusable(el, body) {
  return Boolean(el && el !== body && typeof el.focus === "function");
}
