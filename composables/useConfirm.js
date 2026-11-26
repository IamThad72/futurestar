import { buildConfirmCopy } from "~/utils/confirmCopy";

/**
 * In-app confirm. Returns true only when the person chooses the confirm
 * button. Cancel, the backdrop, and the Android back button resolve false.
 * Ionic renders header and message as plain text, so the strings are not
 * HTML-escaped. If the alert cannot be shown, the action is declined.
 */
export function useConfirm() {
  const { warning } = useHaptics();

  async function confirm(options = {}) {
    const copy = buildConfirmCopy(options);
    const destructive = options.destructive === true;
    if (destructive) warning();

    try {
      const { alertController } = await import("@ionic/vue");
      if (typeof alertController?.create !== "function") {
        return false;
      }
      const alert = await alertController.create({
        header: copy.header,
        message: copy.message || undefined,
        backdropDismiss: true,
        buttons: [
          { text: copy.cancelText, role: "cancel" },
          {
            text: copy.confirmText,
            role: destructive ? "destructive" : "confirm",
          },
        ],
      });
      await alert.present();
      const detail = await alert.onDidDismiss();
      const role = detail?.role;
      return role === "confirm" || role === "destructive";
    } catch {
      return false;
    }
  }

  return { confirm };
}
