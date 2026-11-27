import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import barcode from "../server/api/physical/nutrition/barcode.get";
import foods from "../server/api/physical/nutrition/foods.get";
import intake from "../server/api/physical/nutrition/intake.post";
import suggest from "../server/api/physical/nutrition/intake/suggest.post";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("nutrition log routes", () => {
  it("removes meal describe and still resolves suggest, intake, barcode, and foods", () => {
    expect(existsSync(join(root, "server/api/physical/nutrition/intake/describe.post.ts"))).toBe(false);

    const kept = [
      ["server/api/physical/nutrition/intake/suggest.post.ts", suggest],
      ["server/api/physical/nutrition/intake.post.ts", intake],
      ["server/api/physical/nutrition/barcode.get.ts", barcode],
      ["server/api/physical/nutrition/foods.get.ts", foods],
    ] as const;

    for (const [relative, handler] of kept) {
      expect(existsSync(join(root, relative)), relative).toBe(true);
      expect(typeof handler, relative).toBe("function");
    }
  });

  it("keeps the other Groq describe callers and the Log food picker split", () => {
    expect(existsSync(join(root, "server/api/physical/journal/describe.post.ts"))).toBe(true);
    expect(existsSync(join(root, "server/api/budget/transactions/draft.post.ts"))).toBe(true);
    expect(existsSync(join(root, "server/utils/groq.ts"))).toBe(true);

    const config = readFileSync(join(root, "nuxt.config.ts"), "utf8");
    expect(config).toContain("groqApiKey");
    expect(config).toContain("GROQ_API_KEY");
    expect(config).not.toMatch(/Meal logging/);

    const source = readFileSync(join(root, "components/NutritionTracker.vue"), "utf8");
    expect(source).not.toContain("Describe a meal");
    expect(source).not.toContain("describeText");
    expect(source).not.toContain("logFromDescription");
    expect(source).not.toContain("/api/physical/nutrition/intake/describe");
    expect(source).toContain("openDescribed");
    expect(source).toContain("confirmDescribedFoods");
    expect(source).toContain("describeModalEl");
    expect(source).toContain('v-if="isNarrow"');
    expect(source).toContain("ComboboxInput");
    expect(source).toContain("What's left today");
  });
});
