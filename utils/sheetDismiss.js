/**
 * Ask the ion-modal instance to dismiss. Vue then unmounts the Teleport.
 * Do not remove the element from the DOM; that races Ionic's own cleanup.
 */
export function dismissModal(modalRef) {
  const el = modalRef?.$el ?? modalRef;
  if (el && typeof el.dismiss === "function") return el.dismiss();
  return undefined;
}