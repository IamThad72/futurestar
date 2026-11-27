/**
 * Profile photos are stored as data URLs on `app_users.profile_photo`.
 * Only raster images are accepted. SVG is rejected because it can carry script.
 * The length cap matches the update-profile route (100_000 characters).
 */

export const PROFILE_PHOTO_MAX_LENGTH = 100000;

const PROFILE_PHOTO_TOO_LARGE = "That photo is too large to save. Choose a smaller picture.";
const PROFILE_PHOTO_WRONG_TYPE = "Choose a PNG, JPEG, GIF, or WebP photo.";

const DATA_URL = /^data:image\/(png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const CANONICAL_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** True when `value` is a raster image data URL with canonical base64 and within the size cap. */
export function isProfilePhotoDataUrl(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > PROFILE_PHOTO_MAX_LENGTH) return false;
  const match = DATA_URL.exec(value);
  if (!match) return false;
  return isCanonicalBase64(match[2]);
}

/**
 * Value to store for `profilePhoto`. Blank clears the photo.
 * `error` is a 400 message; `photo` is null when clearing or when `error` is set.
 */
export function normalizeProfilePhoto(input) {
  if (input === undefined || input === null) return { photo: null, error: "" };
  const photo = String(input).trim();
  if (!photo) return { photo: null, error: "" };
  if (photo.length > PROFILE_PHOTO_MAX_LENGTH) return { photo: null, error: PROFILE_PHOTO_TOO_LARGE };
  if (!isProfilePhotoDataUrl(photo)) return { photo: null, error: PROFILE_PHOTO_WRONG_TYPE };
  return { photo, error: "" };
}

function isCanonicalBase64(payload) {
  if (payload.length < 4 || payload.length % 4 !== 0) return false;
  if (!CANONICAL_BASE64.test(payload)) return false;
  try {
    return btoa(atob(payload)) === payload;
  } catch {
    return false;
  }
}
