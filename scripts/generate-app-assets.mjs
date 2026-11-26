/**
 * Draws the Sacred Ledger icon and splash sources.
 * Run via `npm run assets:generate` (also the first step of `npm run cap:assets`).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import {
  COLORS,
  ICON_SIZE,
  SPLASH_CROP_FRACTION,
  SPLASH_SIZE,
  SPLASH_STAR_HEIGHT,
  SPLASH_WORDMARK,
  TALL_PHONE_WIDTH_FRACTION,
  centerCropRect,
  foregroundSvg,
  iconSvg,
  placeWordmark,
  splashStarSvg,
  webManifest,
  wordmarkSvg,
} from "../utils/appIconArtwork.js";

const root = join(import.meta.dirname, "..");
const resourcesDir = join(root, "resources");
const iconsDir = join(root, "public", "icons");

await mkdir(resourcesDir, { recursive: true });
await mkdir(iconsDir, { recursive: true });

const iconPng = await sharp(Buffer.from(iconSvg()))
  .resize(ICON_SIZE, ICON_SIZE)
  .flatten({ background: COLORS.navy })
  .removeAlpha()
  .png()
  .toBuffer();
assertIcon(await sharp(iconPng).metadata());
await writeFile(join(resourcesDir, "icon-only.png"), iconPng);

await sharp(Buffer.from(foregroundSvg())).png().toFile(join(resourcesDir, "icon-foreground.png"));

await sharp({
  create: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    channels: 3,
    background: COLORS.navy,
  },
})
  .removeAlpha()
  .png()
  .toFile(join(resourcesDir, "icon-background.png"));

const lightSplash = await renderSplash(COLORS.parchment, COLORS.ink);
const darkSplash = await renderSplash(COLORS.night, COLORS.parchment);
await writeFile(join(resourcesDir, "splash.png"), lightSplash);
await writeFile(join(resourcesDir, "splash-dark.png"), darkSplash);

await sharp(iconPng).resize(192, 192).png().toFile(join(iconsDir, "icon-192.png"));
await sharp(iconPng).resize(512, 512).png().toFile(join(iconsDir, "icon-512.png"));
await sharp(iconPng).resize(512, 512).png().toFile(join(iconsDir, "icon-512-maskable.png"));
await sharp(iconPng).resize(180, 180).png().toFile(join(iconsDir, "apple-touch-icon.png"));

await writeFile(
  join(root, "public", "manifest.webmanifest"),
  `${JSON.stringify(webManifest(), null, 2)}\n`,
);

await writeFile(join(resourcesDir, "README.md"), readme());

console.log("Wrote resources icon and splash sources, public/icons, and the web manifest");

async function renderSplash(background, wordmarkFill) {
  const starPng = await sharp(Buffer.from(splashStarSvg())).ensureAlpha().png().toBuffer();
  const starTrim = await sharp(starPng).trim().png().toBuffer({ resolveWithObject: true });
  const wordPng = await sharp(Buffer.from(wordmarkSvg(wordmarkFill))).ensureAlpha().png().toBuffer();
  const wordTrim = await sharp(wordPng).trim().png().toBuffer({ resolveWithObject: true });

  if (wordTrim.info.width < 400 || wordTrim.info.height < 40) {
    throw new Error(
      `Wordmark "${SPLASH_WORDMARK}" did not render (got ${wordTrim.info.width}×${wordTrim.info.height}). A serif font is required.`,
    );
  }

  const placed = placeWordmark(
    SPLASH_SIZE,
    starTrim.info,
    wordTrim.info.width,
    wordTrim.info.height,
    SPLASH_STAR_HEIGHT,
  );
  assertInside("9:16 splash crop", placed, centerCropRect(SPLASH_SIZE, SPLASH_CROP_FRACTION));
  assertInside(
    "tall-phone width",
    placed,
    centerCropRect(SPLASH_SIZE, TALL_PHONE_WIDTH_FRACTION),
    { horizontalOnly: true },
  );
  if (placed.gap < placed.starHeight) {
    throw new Error(`Splash gap ${placed.gap}px is shorter than the star (${placed.starHeight}px)`);
  }

  return sharp({
    create: {
      width: SPLASH_SIZE,
      height: SPLASH_SIZE,
      channels: 4,
      background,
    },
  })
    .composite([
      { input: starPng, left: 0, top: 0 },
      { input: wordTrim.data, left: placed.left, top: placed.top },
    ])
    .png()
    .toBuffer();
}

function assertInside(label, placed, rect, { horizontalOnly = false } = {}) {
  const horizontal = [
    ["star", placed.starLeft, placed.starRight],
    ["wordmark", placed.left, placed.right],
  ];
  for (const [name, min, max] of horizontal) {
    if (min < rect.min || max > rect.max) {
      throw new Error(`${name} falls outside the ${label} (${Math.round(min)}–${Math.round(max)}, safe ${rect.min}–${rect.max})`);
    }
  }
  if (horizontalOnly) return;
  if (placed.starTop < rect.min || placed.bottom > rect.max) {
    throw new Error(
      `Splash artwork falls outside the ${label} vertically (${Math.round(placed.starTop)}–${placed.bottom}, safe ${rect.min}–${rect.max})`,
    );
  }
}

function assertIcon(meta) {
  if (meta.width !== ICON_SIZE || meta.height !== ICON_SIZE || meta.hasAlpha || meta.channels !== 3) {
    throw new Error(
      `icon-only.png must be ${ICON_SIZE}×${ICON_SIZE} RGB without alpha, got ${meta.width}×${meta.height} channels=${meta.channels} hasAlpha=${meta.hasAlpha}`,
    );
  }
}

function readme() {
  return `# App icon and splash sources

Sacred Ledger mark: navy \`${COLORS.navy}\` and gold \`${COLORS.gold}\`. These are the tokens in \`assets/css/main.css\`. Do not recolor them here.

| File | Size | Use |
| --- | --- | --- |
| \`icon-only.png\` | 1024×1024 | iOS icon and Android legacy icon. Opaque RGB, square corners. |
| \`icon-foreground.png\` | 1024×1024 | Android adaptive foreground. Transparent background, star inside the central 66% safe zone. |
| \`icon-background.png\` | 1024×1024 | Solid navy adaptive background. |
| \`splash.png\` | 2732×2732 | Light splash on parchment \`${COLORS.parchment}\`. |
| \`splash-dark.png\` | 2732×2732 | Dark splash on \`${COLORS.night}\`, gold star, light wordmark. |

The star's bounding box is centered. "Future Star" sits below it with a gap of one star height, inside the 9:16 center crop that Android splash sizes use and inside the width a 360×800 phone keeps when the square splash is aspect-filled.

Regenerate native assets:

\`\`\`bash
npm run cap:assets
\`\`\`

That redraws these files and \`public/icons/\`, runs \`@capacitor/assets\` 3.0.5 for iOS and Android, then \`scripts/normalize-native-icons.mjs\`.

The color flags in \`package.json\` are double-quoted. Windows cmd passes single quotes through, which made the generator read the quote characters as part of the color.

\`@capacitor/assets\` 3.0.5 is limited to \`--ios\` and \`--android\`. Its PWA pass writes PNG bytes to repo-root \`icons/*.webp\`, points the manifest at those files, and fetches Apple's layout page for splash sizes. The web manifest and \`public/icons/*.png\` are written here instead.

The same version insets the adaptive background by 16.7% (a transparent rim) and writes the foreground at legacy launcher sizes. \`normalize-native-icons.mjs\` restores a full-bleed \`${COLORS.navy}\` color background, writes 108dp foreground PNGs, and keeps the legacy launcher opaque.

Do not bump \`versionCode\`, \`MARKETING_VERSION\`, or \`CURRENT_PROJECT_VERSION\` from this command.

Edit \`utils/appIconArtwork.js\` to change the mark. The colors stay on the tokens above.
`;
}
