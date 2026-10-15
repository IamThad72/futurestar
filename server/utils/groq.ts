import { createError } from "h3";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b";

type ChatResponse = {
  choices?: Array<{
    message?: { content?: string | null; reasoning?: string | null };
  }>;
  error?: { message?: string; type?: string };
};

function runtimeValue(key: "groqApiKey" | "groqModel"): string {
  try {
    const config = useRuntimeConfig();
    return String(config[key] || "").trim();
  } catch {
    return "";
  }
}

function apiKey(): string {
  return runtimeValue("groqApiKey") || String(process.env.GROQ_API_KEY || process.env.NUXT_GROQ_API_KEY || "").trim();
}

function modelName(): string {
  return runtimeValue("groqModel") || String(process.env.GROQ_MODEL || process.env.NUXT_GROQ_MODEL || DEFAULT_MODEL).trim();
}

export function parseModelJson(text: string): unknown {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw createError({ statusCode: 502, statusMessage: "The model returned an empty response." });
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
  }
  throw createError({ statusCode: 502, statusMessage: "The model did not return usable JSON." });
}

/** One JSON completion through Groq. The key stays on the server. */
export async function generateJson(instruction: string, payload: unknown): Promise<unknown> {
  const key = apiKey();
  if (!key) {
    throw createError({
      statusCode: 503,
      statusMessage: "Set GROQ_API_KEY in the server environment to use this.",
    });
  }

  const model = modelName();
  const body: Record<string, unknown> = {
    model,
    temperature: 0,
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: `${instruction}\n\nRespond with JSON only.\n\n${JSON.stringify(payload)}`,
      },
    ],
  };
  if (model.includes("gpt-oss")) body.reasoning_effort = "low";

  let response: Response;
  try {
    response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify(body),
    });
  } catch (error) {
    const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw createError({ statusCode: 504, statusMessage: "The model took too long. Try a shorter request." });
    }
    throw createError({ statusCode: 502, statusMessage: "Could not reach Groq. Try again shortly." });
  }

  const payloadBody = (await response.json().catch(() => ({}))) as ChatResponse;
  if (!response.ok) {
    const status = response.status === 429 ? 503 : 502;
    const message =
      response.status === 429
        ? "Groq is busy. Try again shortly."
        : "The Groq request failed. Check GROQ_API_KEY and try again.";
    console.error("groq request failed", response.status, payloadBody.error?.type || "");
    throw createError({ statusCode: status, statusMessage: message });
  }

  const message = payloadBody.choices?.[0]?.message;
  const text = String(message?.content || message?.reasoning || "");
  return parseModelJson(text);
}
