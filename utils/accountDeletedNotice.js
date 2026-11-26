/** Shown on the login page after a successful in-app deletion. Not a redirect parameter. */

export const ACCOUNT_DELETED_NOTICE_KEY = "accountDeletedNotice";
export const ACCOUNT_DELETED_NOTICE = "Your account has been deleted.";

export function rememberAccountDeleted() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(ACCOUNT_DELETED_NOTICE_KEY, ACCOUNT_DELETED_NOTICE);
}

export function takeAccountDeletedNotice() {
  if (typeof sessionStorage === "undefined") return "";
  const notice = sessionStorage.getItem(ACCOUNT_DELETED_NOTICE_KEY) || "";
  if (notice) sessionStorage.removeItem(ACCOUNT_DELETED_NOTICE_KEY);
  return notice;
}
