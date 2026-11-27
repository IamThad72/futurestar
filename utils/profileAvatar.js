/**
 * Signed-in avatar for the You page and the You tab.
 *
 * The photo and name come from the session user (`/api/auth/me`):
 * `profile_photo` and `display_name`. That is the same field the phone
 * header avatar used before it was removed. No extra request.
 *
 * An img src is returned only for a raster data URL
 * (`data:image/(png|jpeg|jpg|gif|webp);base64,...`). Anything else, including
 * javascript:, http(s):, and SVG, falls back to the circle-user icon.
 */

import { isProfilePhotoDataUrl } from "./profilePhoto.js";

/** Icon the You tab already uses when it is not showing a photo. */
export const YOU_TAB_FALLBACK_ICON = "circle-user";

/** Safe img src for a profile photo, or "" so the caller keeps the placeholder icon. */
export function profilePhotoUrl(user) {
  const photo = user?.profile_photo;
  if (typeof photo !== "string") return "";
  const trimmed = photo.trim();
  return isProfilePhotoDataUrl(trimmed) ? trimmed : "";
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
