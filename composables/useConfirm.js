import { buildConfirmCopy } from "~/utils/confirmCopy";

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * In-app confirm. Returns true only when the person chooses the confirm
 * button. Cancel, the backdrop, and the Android back button resolve false.
 * If Ionic's alert controller is unavailable, falls back to window.confirm.
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
        throw new Error("alertController unavailable");
      }
      const alert = await alertController.create({
        header: escapeHtml(copy.header),
        message: copy.message ? escapeHtml(copy.message) : undefined,
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
      if (typeof window !== "undefined" && typeof window.confirm === "function") {
        return window.confirm(copy.message || copy.header);
      }
      return false;
    }
  }

  return { confirm };
}
