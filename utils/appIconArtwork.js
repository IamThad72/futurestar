/**
 * Sacred Ledger icon and splash geometry.
 *
 * The installed mark is a full-bleed navy square and a gold five-point star.
 * Stores apply their own corner mask, so the source has no rounded corners
 * and no transparent pixels. Android adaptive masks crop to the central 66%
 * of the foreground, and @capacitor/assets center-crops the splash to 9:16
 * and 16:9, so the star and wordmark have to live inside those regions.
 *
 * Colors are the Sacred Ledger tokens in assets/css/main.css. Do not recolor
 * them here.
 */

export const COLORS = {
  navy: "#1F3A5F",
  gold: "#C9A24A",
  parchment: "#FBF8F3",
  ink: "#1C2430",
  night: "#0F1621",
};

export const ICON_SIZE = 1024;
export const SPLASH_SIZE = 2732;

/** Matches the previous star's width (about 570px on the 1024 canvas). */
export const ICON_STAR_OUTER_RADIUS = 300;

/** Ink height of the splash star. The wordmark gap is this same distance. */
export const SPLASH_STAR_HEIGHT = 400;

export const SPLASH_WORDMARK = "Future Star";
export const SPLASH_WORDMARK_FONT_SIZE = 140;

/** Android adaptive safe zone is the central 66% (72dp of the 108dp layer). */
export const ADAPTIVE_SAFE_FRACTION = 0.66;

/**
 * Narrowest splash @capacitor/assets 3.0.5 actually writes (720×1280 and
 * 1280×720). Anything outside this center crop is cut off on Android.
 */
export const SPLASH_CROP_FRACTION = 9 / 16;

/** 360×800 portrait, the tall-phone case. Aspect-fill crops the sides. */
export const TALL_PHONE_WIDTH_FRACTION = 360 / 800;

export const ANDROID_LEGACY_ICON_SIZES = {
  ldpi: 36,
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

/** 108dp adaptive layers. @capacitor/assets 3.0.5 writes the legacy sizes instead. */
export const ANDROID_ADAPTIVE_ICON_SIZES = {
  ldpi: 81,
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
};

const INNER_TO_OUTER = Math.sin(Math.PI / 10) / Math.sin((3 * Math.PI) / 10);

export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

export function starPoints(cx, cy, outerRadius) {
  const innerRadius = outerRadius * INNER_TO_OUTER;
  const points = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  return points;
}

export function boundingBox(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

export function translatePoints(points, dx, dy) {
  return points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
}

/**
 * A regular star's tips are not symmetric around its crossing point: the top
 * tip sticks out farther than the two bottom tips. Centering the bounding box
 * puts equal navy above the top tip and below the bottom tips, which is the
 * optical center of the mark in a square.
 */
export function opticallyCenteredStar(canvasSize, outerRadius) {
  const draft = starPoints(0, 0, outerRadius);
  const box = boundingBox(draft);
  const dx = canvasSize / 2 - (box.minX + box.maxX) / 2;
  const dy = canvasSize / 2 - (box.minY + box.maxY) / 2;
  return translatePoints(draft, dx, dy);
}

export function outerRadiusForHeight(targetHeight) {
  const box = boundingBox(starPoints(0, 0, 1));
  return targetHeight / (box.maxY - box.minY);
}

export function farthestFrom(points, cx, cy) {
  return points.reduce((max, point) => Math.max(max, Math.hypot(point.x - cx, point.y - cy)), 0);
}

export function centerCropRect(canvasSize, visibleFraction) {
  const visible = Math.floor(canvasSize * visibleFraction);
  const min = Math.floor((canvasSize - visible) / 2);
  return { min, max: min + visible, visible };
}

export function pointsToPath(points) {
  const format = (value) => (Math.round(value * 100) / 100).toString();
  const [first, ...rest] = points;
  const lines = rest.map((point) => `L${format(point.x)} ${format(point.y)}`);
  return `M${format(first.x)} ${format(first.y)} ${lines.join(" ")} Z`;
}

export function iconStarPoints() {
  return opticallyCenteredStar(ICON_SIZE, ICON_STAR_OUTER_RADIUS);
}

export function splashStarPoints() {
  return opticallyCenteredStar(SPLASH_SIZE, outerRadiusForHeight(SPLASH_STAR_HEIGHT));
}

export function iconSvg() {
  return squareSvg(ICON_SIZE, COLORS.navy, iconStarPoints(), COLORS.gold);
}

export function foregroundSvg() {
  return squareSvg(ICON_SIZE, "none", iconStarPoints(), COLORS.gold);
}

export function splashStarSvg() {
  return squareSvg(SPLASH_SIZE, "none", splashStarPoints(), COLORS.gold);
}

function squareSvg(size, background, points, starFill) {
  const backgroundRect =
    background === "none"
      ? ""
      : `<rect width="${size}" height="${size}" fill="${background}"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${backgroundRect}
  <path d="${pointsToPath(points)}" fill="${starFill}"/>
</svg>`;
}

export function wordmarkSvg(fill) {
  const fontSize = SPLASH_WORDMARK_FONT_SIZE;
  const width = Math.round(fontSize * 12);
  const height = Math.round(fontSize * 3);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <text x="8" y="${Math.round(fontSize * 1.4)}" fill="${fill}" font-family="Liberation Serif, Georgia, 'Times New Roman', 'Noto Serif', serif" font-size="${fontSize}" font-weight="700">${SPLASH_WORDMARK}</text>
</svg>`;
}

/**
 * Place the trimmed wordmark one star-height below the star's ink.
 * `trimOffset*` comes from sharp and is negative; the ink starts at -offset.
 */
export function placeWordmark(canvasSize, starTrim, wordWidth, wordHeight, minGap = 0) {
  const starTop = -starTrim.trimOffsetTop;
  const starLeft = -starTrim.trimOffsetLeft;
  const starHeight = starTrim.height;
  const starBottom = starTop + starHeight;
  // Two extra pixels cover antialiasing so the empty rows are at least one star tall.
  const gap = Math.max(starHeight, minGap) + 2;
  const top = Math.round(starBottom + gap);
  const left = Math.round((canvasSize - wordWidth) / 2);
  return {
    left,
    top,
    gap,
    starLeft,
    starTop,
    starHeight,
    starBottom,
    starRight: starLeft + starTrim.width,
    bottom: top + wordHeight,
    right: left + wordWidth,
  };
}

export function webManifest() {
  return {
    name: "Future Star",
    short_name: "Future Star",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: COLORS.parchment,
    theme_color: COLORS.navy,
    icons: [
      { src: "/icons/icon-192.png", type: "image/png", sizes: "192x192", purpose: "any" },
      { src: "/icons/icon-512.png", type: "image/png", sizes: "512x512", purpose: "any" },
      {
        src: "/icons/icon-512-maskable.png",
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable",
      },
    ],
  };
}
