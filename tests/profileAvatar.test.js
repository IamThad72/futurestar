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

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PHOTO = "data:image/png;base64,abc";

test("a saved profile photo is shown until it fails to load", () => {
  const user = { profile_photo: PHOTO, display_name: "Thaddeus" };
  assert.equal(profilePhotoUrl(user), PHOTO);
  assert.equal(showProfileAvatar(user), true);
  assert.equal(showProfileAvatar(user, false), true);
  assert.equal(showProfileAvatar(user, true), false);
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
