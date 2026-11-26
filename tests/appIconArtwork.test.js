import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ADAPTIVE_SAFE_FRACTION,
  COLORS,
  ICON_SIZE,
  ICON_STAR_OUTER_RADIUS,
  SPLASH_CROP_FRACTION,
  SPLASH_SIZE,
  SPLASH_STAR_HEIGHT,
  TALL_PHONE_WIDTH_FRACTION,
  boundingBox,
  centerCropRect,
  farthestFrom,
  foregroundSvg,
  iconStarPoints,
  iconSvg,
  outerRadiusForHeight,
  placeWordmark,
  splashStarPoints,
  webManifest,
} from "../utils/appIconArtwork.js";

test("icon star bounding box is centered and the square has no corner radius", () => {
  const box = boundingBox(iconStarPoints());
  assert.ok(Math.abs((box.minX + box.maxX) / 2 - ICON_SIZE / 2) < 0.05);
  assert.ok(Math.abs((box.minY + box.maxY) / 2 - ICON_SIZE / 2) < 0.05);
  assert.equal(box.minX > 0 && box.maxX < ICON_SIZE && box.minY > 0 && box.maxY < ICON_SIZE, true);

  const svg = iconSvg();
  assert.equal(svg.includes("rx="), false);
  assert.match(svg, new RegExp(`<rect width="${ICON_SIZE}" height="${ICON_SIZE}" fill="${COLORS.navy}"/>`));
  assert.match(svg, new RegExp(`fill="${COLORS.gold}"`));
});

test("adaptive foreground star stays inside the central 66 percent circle", () => {
  const center = ICON_SIZE / 2;
  const farthest = farthestFrom(iconStarPoints(), center, center);
  const safeRadius = (ICON_SIZE * ADAPTIVE_SAFE_FRACTION) / 2;
  assert.ok(farthest < safeRadius, `${farthest} is outside the safe radius ${safeRadius}`);
  assert.ok(ICON_STAR_OUTER_RADIUS > 0);
  assert.equal(foregroundSvg().includes("<rect"), false);
});

test("splash star is centered and the wordmark clears it inside the crops", () => {
  const points = splashStarPoints();
  const box = boundingBox(points);
  const height = box.maxY - box.minY;
  assert.ok(Math.abs(height - SPLASH_STAR_HEIGHT) < 0.5);
  assert.ok(Math.abs((box.minX + box.maxX) / 2 - SPLASH_SIZE / 2) < 0.05);
  assert.ok(Math.abs((box.minY + box.maxY) / 2 - SPLASH_SIZE / 2) < 0.05);

  const radius = outerRadiusForHeight(SPLASH_STAR_HEIGHT);
  assert.ok(radius > 0);

  const starTrim = {
    trimOffsetLeft: -box.minX,
    trimOffsetTop: -box.minY,
    width: box.maxX - box.minX,
    height,
  };
  const wordWidth = 700;
  const wordHeight = 96;
  const placed = placeWordmark(SPLASH_SIZE, starTrim, wordWidth, wordHeight, SPLASH_STAR_HEIGHT);
  assert.ok(placed.gap >= SPLASH_STAR_HEIGHT);
  assert.ok(placed.gap >= placed.starHeight);
  assert.ok(placed.top >= placed.starBottom);

  for (const rect of [
    centerCropRect(SPLASH_SIZE, SPLASH_CROP_FRACTION),
    centerCropRect(SPLASH_SIZE, TALL_PHONE_WIDTH_FRACTION),
  ]) {
    assert.ok(placed.starLeft >= rect.min && placed.starRight <= rect.max);
    assert.ok(placed.left >= rect.min && placed.right <= rect.max);
  }
  const portraitSafe = centerCropRect(SPLASH_SIZE, SPLASH_CROP_FRACTION);
  assert.ok(placed.starTop >= portraitSafe.min && placed.bottom <= portraitSafe.max);
});

test("web manifest names the app and points at png icons", () => {
  const manifest = webManifest();
  assert.equal(manifest.name, "Future Star");
  assert.equal(manifest.short_name, "Future Star");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.background_color, COLORS.parchment);
  assert.equal(manifest.theme_color, COLORS.navy);
  assert.deepEqual(
    manifest.icons.map((icon) => icon.src),
    ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-512-maskable.png"],
  );
  for (const icon of manifest.icons) {
    assert.equal(icon.type, "image/png");
    assert.match(icon.sizes, /^\d+x\d+$/);
  }
});

test("artwork colors are the Sacred Ledger tokens", () => {
  const css = readFileSync(new URL("../assets/css/main.css", import.meta.url), "utf8");
  assert.match(css, /--color-navy:\s*#1f3a5f/i);
  assert.match(css, /--color-gold:\s*#c9a24a/i);
  assert.match(css, /--color-parchment:\s*#fbf8f3/i);
  assert.match(css, /--color-ink:\s*#1c2430/i);
  assert.match(css, /--color-gray-950:\s*#0f1621/i);
  assert.equal(COLORS.navy.toLowerCase(), "#1f3a5f");
  assert.equal(COLORS.gold.toLowerCase(), "#c9a24a");
  assert.equal(COLORS.parchment.toLowerCase(), "#fbf8f3");
  assert.equal(COLORS.ink.toLowerCase(), "#1c2430");
  assert.equal(COLORS.night.toLowerCase(), "#0f1621");
});

test("cap:assets quotes colors so Windows cmd does not keep the quotes", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const script = pkg.scripts["cap:assets"];
  assert.match(script, /npm run assets:generate && npx @capacitor\/assets generate /);
  assert.match(script, /--assetPath resources/);
  assert.match(script, /--ios --android/);
  assert.match(script, /--iconBackgroundColor "#1F3A5F"/);
  assert.match(script, /--iconBackgroundColorDark "#0F1621"/);
  assert.match(script, /--splashBackgroundColor "#FBF8F3"/);
  assert.match(script, /--splashBackgroundColorDark "#0F1621"/);
  assert.equal(script.includes("'#"), false);
  assert.match(script, /node scripts\/normalize-native-icons\.mjs$/);
});
