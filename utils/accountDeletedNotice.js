/** Shown on the login page after a successful in-app deletion. Not a redirect parameter. */

export const ACCOUNT_DELETED_NOTICE_KEY = "accountDeletedNotice";
export const ACCOUNT_DELETED_NOTICE = "Your account has been deleted.";
export const ACCOUNT_DELETED_PENDING_NOTICE =
  "Your account has been deleted. Removing the sign-in is still finishing. It will be retried, and that sign-in cannot open a new account.";

export function rememberAccountDeleted(authRemovalPending = false) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(
    ACCOUNT_DELETED_NOTICE_KEY,
    authRemovalPending ? ACCOUNT_DELETED_PENDING_NOTICE : ACCOUNT_DELETED_NOTICE,
  );
}

export function takeAccountDeletedNotice() {
  if (typeof sessionStorage === "undefined") return "";
  const notice = sessionStorage.getItem(ACCOUNT_DELETED_NOTICE_KEY) || "";
  if (notice) sessionStorage.removeItem(ACCOUNT_DELETED_NOTICE_KEY);
  return notice;
}
