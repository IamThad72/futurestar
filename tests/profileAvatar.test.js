import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  YOU_TAB_FALLBACK_ICON,
  profileIdentity,
  profilePhotoUrl,
  showProfileAvatar,
} from "../utils/profileAvatar.js";
import { PROFILE_PHOTO_MAX_LENGTH } from "../utils/profilePhoto.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PHOTO = `data:image/png;base64,${btoa("ok")}`;

function photo(type) {
  return `data:image/${type};base64,${btoa("ok")}`;
}

test("a saved profile photo is shown until it fails to load", () => {
  const user = { profile_photo: PHOTO, display_name: "Thaddeus" };
  assert.equal(profilePhotoUrl(user), PHOTO);
  assert.equal(showProfileAvatar(user), true);
  assert.equal(showProfileAvatar(user, false), true);
  assert.equal(showProfileAvatar(user, true), false);
});

test("only a raster image data URL is used as the img src", () => {
  for (const type of ["png", "jpeg", "jpg", "gif", "webp"]) {
    const url = photo(type);
    assert.equal(profilePhotoUrl({ profile_photo: `  ${url}  ` }), url);
    assert.equal(showProfileAvatar({ profile_photo: url }), true);
  }

  const svg = `data:image/svg+xml;base64,${btoa("<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'></svg>")}`;
  const rejected = [
    "javascript:alert(1)",
    "JavaScript:alert(document.cookie)",
    "http://example.com/a.png",
    "https://example.com/a.png",
    svg,
    "data:image/svg+xml;base64," + btoa("ok"),
    "data:image/png;base64,abc",
    "data:image/png;base64,@@@@",
    "data:image/png;base64,aa==",
    "data:image/png;base64,",
    "data:image/PNG;base64," + btoa("ok"),
    `data:image/png;base64,${"A".repeat(PROFILE_PHOTO_MAX_LENGTH)}`,
  ];
  for (const url of rejected) {
    assert.equal(profilePhotoUrl({ profile_photo: url }), "", url);
    assert.equal(showProfileAvatar({ profile_photo: url }), false, url);
  }
  assert.equal(YOU_TAB_FALLBACK_ICON, "circle-user");
});

test("missing or blank photos fall back to the current You tab icon", () => {
  const nav = readFileSync(join(root, "utils/primaryNav.js"), "utf8");
  assert.match(nav, /name:\s*"You"[\s\S]*?icon:\s*"circle-user"/);
  assert.equal(YOU_TAB_FALLBACK_ICON, "circle-user");

  for (const user of [null, undefined, {}, { profile_photo: null }, { profile_photo: "" }, { profile_photo: "   " }, { profile_photo: 12 }]) {
    assert.equal(profilePhotoUrl(user), "");
    assert.equal(showProfileAvatar(user), false);
    assert.equal(showProfileAvatar(user, true), false);
  }
});

test("the profile card uses the display name, then the email", () => {
  assert.deepEqual(profileIdentity({ display_name: "Thaddeus Marcelli", email: "thad@example.com" }), {
    name: "Thaddeus Marcelli",
    email: "thad@example.com",
  });
  assert.deepEqual(profileIdentity({ display_name: "  ", email: "thad@example.com" }), {
    name: "thad@example.com",
    email: "",
  });
  assert.deepEqual(profileIdentity({ display_name: "thad@example.com", email: "thad@example.com" }), {
    name: "thad@example.com",
    email: "",
  });
  assert.deepEqual(profileIdentity(null), { name: "You", email: "" });
});
