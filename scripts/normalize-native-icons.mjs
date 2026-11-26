/**
 * Corrects @capacitor/assets 3.0.5 output after `cap:assets` generates it.
 *
 * That version writes the adaptive foreground at legacy launcher sizes and
 * insets both layers by 16.7%, which leaves a transparent rim around the
 * navy background. It also pads the legacy launcher with transparent pixels.
 * The source artwork already keeps the star inside the adaptive safe zone,
 * so the installed XML uses the foreground as the full 108dp layer on a
 * full-bleed color.
 */
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import {
  ANDROID_ADAPTIVE_ICON_SIZES,
  ANDROID_LEGACY_ICON_SIZES,
  COLORS,
} from "../utils/appIconArtwork.js";

const root = join(import.meta.dirname, "..");
const resDir = join(root, "android", "app", "src", "main", "res");
const iconOnly = join(root, "resources", "icon-only.png");
const iconForeground = join(root, "resources", "icon-foreground.png");

const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;

const backgroundXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${COLORS.navy}</color>
</resources>
`;

await writeFile(join(resDir, "values", "ic_launcher_background.xml"), backgroundXml);
await writeFile(join(resDir, "mipmap-anydpi-v26", "ic_launcher.xml"), adaptiveXml);
await writeFile(join(resDir, "mipmap-anydpi-v26", "ic_launcher_round.xml"), adaptiveXml);

for (const [density, size] of Object.entries(ANDROID_ADAPTIVE_ICON_SIZES)) {
  const dir = join(resDir, `mipmap-${density}`);
  await sharp(iconForeground).resize(size, size).png().toFile(join(dir, "ic_launcher_foreground.png"));
  await rm(join(dir, "ic_launcher_background.png"), { force: true });
}

for (const [density, size] of Object.entries(ANDROID_LEGACY_ICON_SIZES)) {
  const dir = join(resDir, `mipmap-${density}`);
  await sharp(iconOnly)
    .resize(size, size)
    .flatten({ background: COLORS.navy })
    .removeAlpha()
    .png()
    .toFile(join(dir, "ic_launcher.png"));

  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ffffff"/></svg>`,
  );
  await sharp(iconOnly)
    .resize(size, size)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toFile(join(dir, "ic_launcher_round.png"));
}

const iosIconDir = join(root, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset");
await sharp(iconOnly).png().toFile(join(iosIconDir, "AppIcon-512@2x.png"));
await removeUnreferencedPngs(iosIconDir);
await removeUnreferencedPngs(join(root, "ios", "App", "App", "Assets.xcassets", "Splash.imageset"));

console.log("Normalized Android adaptive icons and the iOS app icon");

async function removeUnreferencedPngs(dir) {
  const contents = JSON.parse(await readFile(join(dir, "Contents.json"), "utf8"));
  const referenced = new Set(
    contents.images.map((image) => image.filename).filter((filename) => typeof filename === "string"),
  );
  for (const name of await readdir(dir)) {
    if (name.endsWith(".png") && !referenced.has(name)) {
      await rm(join(dir, name));
      console.log(`Removed unreferenced ${name}`);
    }
  }
}
