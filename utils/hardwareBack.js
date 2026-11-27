/**
 * A presented Ionic overlay (the You phone sheet is an ion-modal) registers
 * for the document `backbutton` event and dismisses itself. The Capacitor
 * listener runs first, so it must leave the page alone while that overlay
 * is up. Otherwise Android Back navigates away and the sheet stays open.
 */
export const PRESENTED_OVERLAY_SELECTOR = "ion-modal:not(.overlay-hidden)";

export function hardwareBackAction(hasPresentedOverlay) {
  return hasPresentedOverlay ? "overlay" : "page";
}
