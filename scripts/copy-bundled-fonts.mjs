/**
 * Copy the two latin variable faces into public/fonts so web and mobile
 * builds can preload a stable URL. The bytes stay the fontsource files.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const bundledFonts = [
  {
    packageName: "@fontsource-variable/inter",
    file: "inter-latin-wght-normal.woff2",
    licenseFile: "inter-OFL.txt",
  },
  {
    packageName: "@fontsource-variable/fraunces",
    file: "fraunces-latin-opsz-normal.woff2",
    licenseFile: "fraunces-OFL.txt",
  },
];

export function bundledFontPublicPath(file) {
  return `/fonts/${file}`;
}

export function bundledFontSourcePath(font) {
  return resolve(root, "node_modules", font.packageName, "files", font.file);
}

export function copyBundledFonts() {
  const fontsDir = resolve(root, "public/fonts");
  mkdirSync(fontsDir, { recursive: true });
  for (const font of bundledFonts) {
    const source = bundledFontSourcePath(font);
    if (!existsSync(source)) {
      throw new Error(`Bundled font missing: ${source}`);
    }
    copyFileSync(source, resolve(fontsDir, font.file));
  }
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  copyBundledFonts();
}
