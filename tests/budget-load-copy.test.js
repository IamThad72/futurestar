import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const pages = [
  {
    file: "pages/cash_flow_mgmt.vue",
    message: "The budget could not be loaded. Try again in a moment.",
  },
  {
    file: "pages/cash_flow_tracker.vue",
    message: "The budget tracker could not be loaded. Try again in a moment.",
  },
];

test("budget load failures stay friendly and keep the migrate hint in the console", () => {
  const readme = read("README.md");
  assert.match(readme, /npm run migrate/);
  assert.match(readme, /The budget could not be loaded\. Try again in a moment\./);
  assert.match(readme, /The budget tracker could not be loaded\. Try again in a moment\./);

  for (const page of pages) {
    const source = read(page.file);
    assert.match(source, new RegExp(page.message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(source, /console\.error\(\s*"[^"]*npm run migrate/);
    const fallbacks = [...source.matchAll(/(?:parseFetchError|settleLoadError)\(\s*(?:err|error),\s*\n?\s*"([^"]+)"/g)].map((match) => match[1]);
    assert.ok(fallbacks.includes(page.message));
    for (const fallback of fallbacks) {
      assert.equal(/npm run migrate|scripts\//.test(fallback), false, `${page.file} shows operators a script: ${fallback}`);
    }
  }
});
