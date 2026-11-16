import { createError, readBody } from "h3";
import { requirePrivateUserId } from "../../utils/privateUserAccess";
import { generateJson } from "../../utils/groq";
import { generateNote } from "../../utils/aiNote";
import { VIRTUE_GROUPS } from "~/utils/spiritualReview.js";

const FOLLOW_FIELDS = new Set(["grateful", "troubled", "shortfall"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function virtueDefinition(name: string): string {
  const needle = name.trim().toLowerCase();
  for (const group of VIRTUE_GROUPS) {
    for (const virtue of group.virtues) {
      if (virtue.name.toLowerCase() === needle) return virtue.definition;
    }
  }
  return "";
}

function questionsFrom(raw: unknown, citations: string[]): string[] {
  const record = asRecord(raw);
  const list = Array.isArray(record?.questions) ? record.questions : [];
  const allowed = citations.map((item) => item.toLowerCase());
  const citation = /\b(?:[1-3]\s)?[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\s\d+:\d+\b/g;
  const questions: string[] = [];
  for (const entry of list) {
    const text = String(entry || "").replace(/\s+/g, " ").trim().slice(0, 240);
    if (text.length < 8) continue;
    const found = text.match(citation) || [];
    const invented = found.some((item) => !allowed.some((cite) => cite.includes(item.toLowerCase())));
    if (invented) continue;
    questions.push(text);
    if (questions.length >= 2) break;
  }
  return questions;
}

function sharesWords(question: string, answer: string): boolean {
  const words = answer.toLowerCase().match(/[a-z][a-z']{3,}/g) || [];
  const unique = [...new Set(words)].slice(0, 12);
  if (!unique.length) return true;
  const hay = question.toLowerCase();
  return unique.some((word) => hay.includes(word));
}

export default defineEventHandler(async (event) => {
  await requirePrivateUserId(event);
  const body = asRecord(await readBody(event));
  const action = String(body?.action || "").trim();

  if (action === "questions") {
    const passages = (Array.isArray(body?.passages) ? body.passages : [])
      .map((entry) => {
        const row = asRecord(entry);
        if (!row) return null;
        const citation = String(row.citation || "").trim().slice(0, 80);
        const text = String(row.text || "").trim().slice(0, 1500);
        if (!citation || !text) return null;
        return { citation, text };
      })
      .filter((row): row is { citation: string; text: string } => Boolean(row))
      .slice(0, 3);
    if (!passages.length) {
      throw createError({ statusCode: 400, statusMessage: "Send the passage already on the page." });
    }
    const fallback = [
      "What stands out in this reading?",
      "What would it look like to live this today?",
    ];
    let questions = fallback;
    try {
      const raw = await generateJson(
        [
          "Write two short reflection questions about these passages.",
          'Return {"questions":["...","..."]}.',
          "Do not quote or paraphrase the verses. Do not add a citation that is not in the payload. Do not write a prayer.",
        ].join(" "),
        { passages },
      );
      const kept = questionsFrom(raw, passages.map((row) => row.citation));
      if (kept.length) questions = kept;
    } catch (error) {
      console.error("scripture questions failed", error);
    }
    return { questions };
  }

  if (action === "virtue") {
    const virtue = String(body?.virtue || "").trim();
    const definition = virtueDefinition(virtue);
    if (!definition) {
      throw createError({ statusCode: 400, statusMessage: "Choose a virtue from the list." });
    }
    const fallback = `Practice ${virtue} today: ${definition.charAt(0).toLowerCase()}${definition.slice(1)}.`;
    const text =
      (await generateNote(
        "Offer one concrete act for today for this virtue. One sentence. Do not write a prayer.",
        { virtue, definition },
      )) || fallback;
    return { text };
  }

  if (action === "followup") {
    const field = String(body?.field || "").trim();
    const answer = String(body?.answer || "").trim().slice(0, 500);
    if (!FOLLOW_FIELDS.has(field) || answer.length < 2) {
      throw createError({ statusCode: 400, statusMessage: "Write an answer before asking a follow-up." });
    }
    const snippet = answer.length > 80 ? `${answer.slice(0, 77)}...` : answer;
    const fallback = `You wrote "${snippet}." What was happening just before that?`;
    let text =
      (await generateNote(
        "Ask one follow-up question that uses the person's own words. Do not answer for them. Do not write a prayer.",
        { field, answer },
      )) || fallback;
    if (!sharesWords(text, answer)) text = fallback;
    return { text };
  }

  if (action === "shorten") {
    const answer = String(body?.answer || "").trim().slice(0, 500);
    if (answer.length < 2) {
      throw createError({ statusCode: 400, statusMessage: "There is no intention to shorten." });
    }
    let text =
      (await generateNote(
        "Shorten this intention to one concrete act. Keep the person's own words. Do not invent a new intention or write a prayer.",
        { answer },
      )) || answer;
    if (!sharesWords(text, answer)) text = answer;
    return { text };
  }

  throw createError({ statusCode: 400, statusMessage: "Unknown assist action." });
});
