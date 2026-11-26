import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as ionicons from "ionicons/icons";
import {
  CUSTOM_ICON_FILES,
  CUSTOM_PREFIX,
  ICON_REGISTRY,
  eachIconSpec,
  overflowIconName,
  resolveIcon,
} from "../utils/iconRegistry.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("every registry entry is an ionicons export or a custom file", () => {
  const seen = new Set();
  for (const spec of eachIconSpec()) {
    if (seen.has(spec)) continue;
    seen.add(spec);
    if (spec.startsWith(CUSTOM_PREFIX)) {
      const id = spec.slice(CUSTOM_PREFIX.length);
      const rel = CUSTOM_ICON_FILES[id];
      assert.ok(rel, `${id} is listed in CUSTOM_ICON_FILES`);
      const svg = readFileSync(join(root, rel), "utf8");
      assert.match(svg, /viewBox="0 0 512 512"/, rel);
      assert.match(svg, /currentColor/, rel);
      continue;
    }
    assert.equal(typeof ionicons[spec], "string", `${spec} is exported by ionicons/icons`);
  }
});

test("legacy names resolve to the Ionicons equivalents", () => {
  assert.equal(resolveIcon("activity", false).exportName, "fitnessOutline");
  assert.equal(resolveIcon("activity", true).exportName, "fitness");
  assert.equal(resolveIcon("landmark", false).exportName, "walletOutline");
  assert.equal(resolveIcon("landmark", true).exportName, "wallet");
  assert.equal(resolveIcon("circle-user", false).exportName, "personCircleOutline");
  assert.equal(resolveIcon("circle-user", true).exportName, "personCircle");
  assert.equal(resolveIcon("sparkles", true).exportName, "sparkles");
  assert.equal(resolveIcon("flame", true).exportName, "flame");
  assert.equal(resolveIcon("star", false).exportName, "starOutline");
  assert.equal(resolveIcon("church", false).customId, "church-outline");
  assert.equal(resolveIcon("church", true).customId, "church-filled");
});

test("unknown names fall back to help-circle and blank names render nothing", () => {
  const unknown = resolveIcon("not-a-real-icon", true);
  assert.equal(unknown.known, false);
  assert.equal(unknown.exportName, "helpCircleOutline");
  assert.equal(typeof ionicons[unknown.exportName], "string");
  const blank = resolveIcon("", false);
  assert.equal(blank.known, false);
  assert.equal(blank.exportName, null);
  assert.equal(blank.customId, null);
});

test("overflow icon is horizontal on iOS and vertical elsewhere", () => {
  assert.equal(overflowIconName("ios"), "ellipsis-horizontal");
  assert.equal(overflowIconName("android"), "ellipsis-vertical");
  assert.equal(overflowIconName("web"), "ellipsis-vertical");
  assert.ok(ICON_REGISTRY[overflowIconName("ios")]);
  assert.ok(ICON_REGISTRY[overflowIconName("android")]);
});

test("every icon used by the nav modules is in the registry", () => {
  const files = ["primaryNav.js", "financialNav.js", "spiritualNav.js", "physicalNav.js"];
  for (const file of files) {
    const source = readFileSync(join(root, "utils", file), "utf8");
    const names = [...source.matchAll(/icon:\s*"([^"]*)"/g)].map((match) => match[1]).filter(Boolean);
    assert.ok(names.length > 0, `${file} names at least one icon`);
    for (const name of names) {
      assert.ok(ICON_REGISTRY[name], `${file} icon "${name}" is registered`);
    }
  }
});

test("AppIcon statically imports every ionicons export the registry names", () => {
  const source = readFileSync(join(root, "components", "AppIcon.vue"), "utf8");
  const needed = new Set(eachIconSpec().filter((spec) => !spec.startsWith(CUSTOM_PREFIX)));
  for (const name of needed) {
    assert.match(source, new RegExp(`\\b${name}\\b`), `AppIcon imports ${name}`);
  }
});
