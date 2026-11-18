import { createError } from "h3";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b";

type ChatResponse = {
  choices?: Array<{
    message?: { content?: string | null; reasoning?: string | null };
  }>;
  error?: { message?: string; type?: string; code?: string };
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

function safeGroqDetail(payload: ChatResponse): string {
  return String(payload.error?.message || payload.error?.code || payload.error?.type || "")
    .replace(/gsk_[A-Za-z0-9]+/g, "[key]")
    .slice(0, 240);
}

async function postChat(body: Record<string, unknown>, key: string): Promise<{ response: Response; payload: ChatResponse }> {
  const response = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as ChatResponse;
  return { response, payload };
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

  let result: { response: Response; payload: ChatResponse };
  try {
    result = await postChat(body, key);
    const detail = safeGroqDetail(result.payload);
    if (!result.response.ok && result.response.status === 400) {
      console.error("groq request failed", result.response.status, detail);
      const relaxed = { ...body };
      delete relaxed.response_format;
      result = await postChat(relaxed, key);
    }
  } catch (error) {
    const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw createError({ statusCode: 504, statusMessage: "The model took too long. Try a shorter request." });
    }
    throw createError({ statusCode: 502, statusMessage: "Could not reach Groq. Try again shortly." });
  }

  if (!result.response.ok) {
    const detail = safeGroqDetail(result.payload);
    console.error("groq request failed", result.response.status, detail);
    const networkDenied = result.response.status === 403 && /network settings/i.test(detail);
    const aboutKey = result.response.status === 401 || /api key/i.test(detail);
    throw createError({
      statusCode: result.response.status === 429 ? 503 : 502,
      statusMessage:
        result.response.status === 429
          ? "Groq is busy. Try again shortly."
          : networkDenied
            ? "Groq refused this network. In ExpressVPN, set Node.js to Bypass VPN, then reconnect."
            : aboutKey
              ? "The Groq request failed. Check GROQ_API_KEY and try again."
              : "Groq could not complete that request. Try again.",
    });
  }

  const message = result.payload.choices?.[0]?.message;
  const text = String(message?.content || message?.reasoning || "");
  return parseModelJson(text);
}
