import { generateJson } from "./groq";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function numbersIn(value: string): string[] {
  return value.match(/\d+(?:\.\d+)?/g) || [];
}

/** True when every number in the sentence also appears in the payload. */
export function noteUsesOnlyKnownNumbers(text: string, payload: unknown): boolean {
  const allowed = new Set(numbersIn(JSON.stringify(payload ?? "")).map((item) => String(Number(item))));
  return numbersIn(text).every((item) => allowed.has(String(Number(item))));
}

/** One short sentence from Groq. Returns null when the model is unavailable or unusable. */
export async function generateNote(instruction: string, payload: unknown, maxLen = 700): Promise<string | null> {
  try {
    const raw = asRecord(
      await generateJson(
        `${instruction} Return {"text":"one or two sentences"}. Use only facts in the payload. Do not add numbers, citations, or advice that are not in the payload.`,
        payload,
      ),
    );
    const text = String(raw?.text || "").replace(/\s+/g, " ").trim();
    if (!text) return null;
    if (!noteUsesOnlyKnownNumbers(text, payload)) return null;
    return text.slice(0, maxLen);
  } catch (error) {
    console.error("ai note failed", error);
    return null;
  }
}
