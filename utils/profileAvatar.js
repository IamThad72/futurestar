/**
 * Signed-in avatar for the You page and the You tab.
 *
 * The photo and name come from the session user (`/api/auth/me`):
 * `profile_photo` and `display_name`. That is the same field the phone
 * header avatar used before it was removed. No extra request.
 */

/** Icon the You tab already uses when it is not showing a photo. */
export const YOU_TAB_FALLBACK_ICON = "circle-user";

/** Trimmed profile photo URL, or "" when the session has none. */
export function profilePhotoUrl(user) {
  const photo = user?.profile_photo;
  if (typeof photo !== "string") return "";
  return photo.trim();
}

/**
 * Show the photo only when the session has one and it has not failed to load.
 * Otherwise the caller keeps the current person icon.
 */
export function showProfileAvatar(user, loadFailed = false) {
  if (loadFailed) return false;
  return profilePhotoUrl(user) !== "";
}

/** Name for the profile card. Email stands in when no display name is saved. */
export function profileIdentity(user) {
  const email = String(user?.email ?? "").trim();
  const name = String(user?.display_name ?? "").trim();
  return {
    name: name || email || "You",
    email: name && email && email !== name ? email : "",
  };
}
