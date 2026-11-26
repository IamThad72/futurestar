import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  ANDROID_ADAPTIVE_ICON_SIZES,
  ANDROID_LEGACY_ICON_SIZES,
  COLORS,
  ICON_SIZE,
  hexToRgb,
  webManifest,
} from "../utils/appIconArtwork.js";

const root = new URL("..", import.meta.url).pathname;
const navy = hexToRgb(COLORS.navy);
const gold = hexToRgb(COLORS.gold);
const parchment = hexToRgb(COLORS.parchment);
const night = hexToRgb(COLORS.night);

test("icon-only.png is an opaque 1024 navy square with a centered gold star", async () => {
  const path = join(root, "resources/icon-only.png");
  const meta = await sharp(path).metadata();
  assert.equal(meta.width, 1024);
  assert.equal(meta.height, 1024);
  assert.equal(meta.channels, 3);
  assert.equal(meta.hasAlpha, false);

  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const [x, y] of [
    [0, 0],
    [info.width - 1, 0],
    [0, info.height - 1],
    [info.width - 1, info.height - 1],
  ]) {
    assert.deepEqual(pixel(data, info, x, y).slice(0, 3), [navy.r, navy.g, navy.b]);
  }
  const center = pixel(data, info, info.width >> 1, info.height >> 1);
  assert.deepEqual(center.slice(0, 3), [gold.r, gold.g, gold.b]);

  const box = inkBox(data, info, (px) => px[0] > 150 && px[1] > 100 && px[2] < 120);
  const midX = (box.minX + box.maxX) / 2;
  const midY = (box.minY + box.maxY) / 2;
  assert.ok(Math.abs(midX - ICON_SIZE / 2) <= 2, `star x ${midX}`);
  assert.ok(Math.abs(midY - ICON_SIZE / 2) <= 2, `star y ${midY}`);
});

test("adaptive foreground keeps the star inside the central 66 percent", async () => {
  const path = join(root, "resources/icon-foreground.png");
  const meta = await sharp(path).metadata();
  assert.equal(meta.hasAlpha, true);
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(pixel(data, info, 0, 0)[3], 0);

  const radius = (info.width * 0.66) / 2;
  const cx = info.width / 2;
  const cy = info.height / 2;
  let outside = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const px = pixel(data, info, x, y);
      if (px[3] < 20 || px[0] < 150) continue;
      if (Math.hypot(x - cx, y - cy) > radius) outside += 1;
    }
  }
  assert.equal(outside, 0);
});

test("splash wordmark clears the star on parchment and on the dark ground", async () => {
  const light = await splashBands(join(root, "resources/splash.png"), parchment);
  const dark = await splashBands(join(root, "resources/splash-dark.png"), night);
  for (const bands of [light, dark]) {
    assert.equal(bands.clusters.length, 2);
    const star = bands.clusters[0].height;
    assert.ok(bands.gap >= star, `gap ${bands.gap} is shorter than the star ${star}`);
    assert.equal(bands.edgeInk, false);
  }
});

test("web manifest icons exist as pngs of the declared size", async () => {
  const manifest = JSON.parse(readFileSync(join(root, "public/manifest.webmanifest"), "utf8"));
  assert.deepEqual(manifest, webManifest());
  for (const icon of manifest.icons) {
    const file = join(root, "public", icon.src);
    assert.equal(existsSync(file), true, icon.src);
    const meta = await sharp(file).metadata();
    const [width, height] = icon.sizes.split("x").map(Number);
    assert.equal(meta.width, width);
    assert.equal(meta.height, height);
    assert.equal(meta.hasAlpha, false);
    assert.equal(icon.type, "image/png");
  }
  const touch = await sharp(join(root, "public/icons/apple-touch-icon.png")).metadata();
  assert.equal(touch.width, 180);
  assert.equal(touch.hasAlpha, false);

  const config = readFileSync(join(root, "nuxt.config.ts"), "utf8");
  assert.match(config, /rel: "manifest", href: "\/manifest.webmanifest"/);
  assert.match(config, /rel: "apple-touch-icon"/);
});

test("installed icons are navy and gold, with no old blue or stock foreground", async () => {
  const background = readFileSync(
    join(root, "android/app/src/main/res/values/ic_launcher_background.xml"),
    "utf8",
  );
  assert.match(background, /#1F3A5F/);
  for (const name of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
    const xml = readFileSync(join(root, "android/app/src/main/res/mipmap-anydpi-v26", name), "utf8");
    assert.match(xml, /@color\/ic_launcher_background/);
    assert.match(xml, /@mipmap\/ic_launcher_foreground/);
    assert.equal(xml.includes("inset"), false);
  }

  for (const [density, size] of Object.entries(ANDROID_ADAPTIVE_ICON_SIZES)) {
    const dir = join(root, "android/app/src/main/res", `mipmap-${density}`);
    const foreground = await sharp(join(dir, "ic_launcher_foreground.png")).metadata();
    assert.equal(foreground.width, size, density);
    assert.equal(foreground.height, size);
    const legacy = await sharp(join(dir, "ic_launcher.png")).metadata();
    assert.equal(legacy.width, ANDROID_LEGACY_ICON_SIZES[density]);
    assert.equal(legacy.hasAlpha, false);
    assert.equal(existsSync(join(dir, "ic_launcher_background.png")), false);
  }

  const ios = await sharp(
    join(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"),
  ).metadata();
  assert.equal(ios.width, 1024);
  assert.equal(ios.hasAlpha, false);

  const pngs = walk(join(root, "android/app/src/main/res")).concat(
    walk(join(root, "ios/App/App/Assets.xcassets")),
  );
  for (const file of pngs) {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let oldBlue = 0;
    let brightYellow = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 20) continue;
      if (b >= 120 && b > r + 40 && g < 120) oldBlue += 1;
      if (r > 230 && g > 190 && b < 60) brightYellow += 1;
    }
    assert.equal(oldBlue, 0, file);
    assert.equal(brightYellow, 0, file);

    if (file.endsWith("ic_launcher.png") || file.endsWith("AppIcon-512@2x.png")) {
      assert.deepEqual(pixel(data, info, 0, 0).slice(0, 3), [navy.r, navy.g, navy.b], file);
    }
  }
});

test("every generated splash keeps the wordmark off the star and off the edges", async () => {
  const files = walk(join(root, "android/app/src/main/res")).filter((file) => file.endsWith("splash.png"));
  files.push(
    ...["1", "2", "3"].flatMap((scale) => [
      join(
        root,
        `ios/App/App/Assets.xcassets/Splash.imageset/Default@${scale}x~universal~anyany.png`,
      ),
      join(
        root,
        `ios/App/App/Assets.xcassets/Splash.imageset/Default@${scale}x~universal~anyany-dark.png`,
      ),
    ]),
  );
  assert.ok(files.length >= 20);
  for (const file of files) {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const bands = bandsFrom(data, info, (px) => {
      if (px[3] < 20) return false;
      return Math.min(distance(px, parchment), distance(px, night)) > 30;
    });
    assert.equal(bands.clusters.length, 2, file);
    const star = bands.clusters[0].height;
    assert.ok(bands.gap >= star - 2, `${file} gap ${bands.gap} star ${star}`);
    assert.equal(bands.edgeInk, false, file);
  }
});

test("release versions and the app id are unchanged", () => {
  const gradle = readFileSync(join(root, "android/app/build.gradle"), "utf8");
  assert.match(gradle, /versionCode 1\b/);
  const project = readFileSync(join(root, "ios/App/App.xcodeproj/project.pbxproj"), "utf8");
  assert.match(project, /MARKETING_VERSION = 1\.0;/);
  assert.match(project, /CURRENT_PROJECT_VERSION = 1;/);
  const config = readFileSync(join(root, "capacitor.config.ts"), "utf8");
  assert.match(config, /appId: "com\.futurestar\.app"/);
  const css = readFileSync(join(root, "assets/css/main.css"), "utf8");
  assert.match(css, /--color-navy:\s*#1f3a5f/i);
  assert.match(css, /--color-gold:\s*#c9a24a/i);
});

function pixel(data, info, x, y) {
  const index = (y * info.width + x) * 4;
  return [data[index], data[index + 1], data[index + 2], data[index + 3]];
}

function distance(px, color) {
  return Math.abs(px[0] - color.r) + Math.abs(px[1] - color.g) + Math.abs(px[2] - color.b);
}

function inkBox(data, info, isInk) {
  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (!isInk(pixel(data, info, x, y))) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

function bandsFrom(data, info, isInk) {
  const rows = [];
  for (let y = 0; y < info.height; y += 1) {
    let ink = false;
    for (let x = 0; x < info.width; x += 1) {
      if (!isInk(pixel(data, info, x, y))) continue;
      ink = true;
      break;
    }
    rows.push(ink);
  }
  const clusters = [];
  let start = -1;
  for (let y = 0; y <= rows.length; y += 1) {
    if (rows[y] && start < 0) start = y;
    if ((!rows[y] || y === rows.length) && start >= 0) {
      clusters.push({ start, end: y - 1, height: y - start });
      start = -1;
    }
  }
  let edgeInk = Boolean(rows[0] || rows[rows.length - 1]);
  if (!edgeInk) {
    for (let y = 0; y < info.height; y += 1) {
      if (isInk(pixel(data, info, 0, y)) || isInk(pixel(data, info, info.width - 1, y))) {
        edgeInk = true;
        break;
      }
    }
  }
  const gap = clusters.length >= 2 ? clusters[1].start - clusters[0].end - 1 : 0;
  return { clusters, gap, edgeInk };
}

async function splashBands(file, background) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return bandsFrom(data, info, (px) => distance(px, background) > 24);
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, acc);
    else if (name.endsWith(".png")) acc.push(path);
  }
  return acc;
}
