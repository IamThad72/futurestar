import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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
