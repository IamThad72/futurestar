import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("estate upload error", () => {
  it("announces the upload error to assistive technology", () => {
    const panel = readFileSync(new URL("../components/EstateDocumentsPanel.vue", import.meta.url), "utf8");
    expect(panel).toContain(
      '<div v-if="uploadError" class="text-sm text-error" role="alert">{{ uploadError }}</div>',
    );
    expect(panel).not.toContain('aria-live="polite"');
  });
});
