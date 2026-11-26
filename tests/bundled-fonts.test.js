import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { bundledFontPublicPath, bundledFonts, copyBundledFonts } from "../scripts/copy-bundled-fonts.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("the app no longer requests Google Fonts", () => {
  const nuxtConfig = read("nuxt.config.ts");
  const mainCss = read("assets/css/main.css");
  assert.equal(nuxtConfig.includes("fonts.googleapis.com"), false);
  assert.equal(nuxtConfig.includes("fonts.gstatic.com"), false);
  assert.equal(mainCss.includes("fonts.googleapis.com"), false);
  assert.equal(mainCss.includes("fonts.gstatic.com"), false);
});

test("variable families keep the previous fallbacks", () => {
  const mainCss = read("assets/css/main.css");
  assert.match(mainCss, /--font-sans:\s*"Inter Variable", ui-sans-serif/);
  assert.match(mainCss, /--font-serif:\s*"Fraunces Variable", ui-serif, Georgia/);
  assert.match(mainCss, /--font-display:\s*"Fraunces Variable", ui-serif, Georgia/);
  assert.match(mainCss, /--ion-font-family:\s*"Inter Variable", ui-sans-serif/);
  assert.match(mainCss, /\.sl-scripture\s*\{[^}]*"Fraunces Variable"/s);
});

test("bundled faces are the latin roman files only", () => {
  const fontsCss = read("assets/css/fonts.css");
  assert.match(fontsCss, /inter-latin-wght-normal\.woff2/);
  assert.match(fontsCss, /fraunces-latin-opsz-normal\.woff2/);
  assert.equal(fontsCss.includes("latin-ext"), false);
  assert.equal(fontsCss.includes("italic"), false);
  assert.equal(fontsCss.includes("cyrillic"), false);
  assert.equal(fontsCss.includes("vietnamese"), false);
  assert.equal(fontsCss.includes("greek"), false);
});

test("both builds can preload the public font files", () => {
  const fontsCss = read("assets/css/fonts.css");
  const nuxtConfig = read("nuxt.config.ts");
  assert.match(nuxtConfig, /copyBundledFonts\(/);
  assert.match(nuxtConfig, /rel:\s*"preload"/);
  assert.match(nuxtConfig, /as:\s*"font"/);
  assert.match(nuxtConfig, /type:\s*"font\/woff2"/);
  assert.match(nuxtConfig, /crossorigin:\s*"anonymous"/);
  for (const font of bundledFonts) {
    const href = bundledFontPublicPath(font.file);
    assert.match(fontsCss, new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(nuxtConfig, /bundledFontPublicPath\(font\.file\)/);
  }
});

test("the app ships the SIL OFL texts that came with the font files", () => {
  copyBundledFonts();
  for (const font of bundledFonts) {
    const shipped = read(`public/licenses/${font.licenseFile}`);
    const upstream = read(`node_modules/${font.packageName}/LICENSE`);
    const face = readFileSync(new URL(`public/fonts/${font.file}`, root));
    const source = readFileSync(new URL(`node_modules/${font.packageName}/files/${font.file}`, root));
    assert.match(shipped, /SIL OPEN FONT LICENSE Version 1\.1/);
    assert.equal(shipped, upstream);
    assert.equal(Buffer.compare(face, source), 0);
  }
});
