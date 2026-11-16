import { createError, readBody } from "h3";
import { getSessionUserId } from "../../../utils/auth";
import { generateJson } from "../../../utils/groq";
import { todayIsoDate } from "~/utils/liturgicalCalendar";
import { parseTransactionSentence } from "~/utils/transactionSentence.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export default defineEventHandler(async (event) => {
  await getSessionUserId(event);
  const body = asRecord(await readBody(event));
  const text = String(body?.text || "").trim();
  const today = String(body?.today || "").trim() || todayIsoDate();
  const parsed = parseTransactionSentence(text, today);
  if (!parsed) {
    throw createError({
      statusCode: 400,
      statusMessage: "Include an amount and what it was for, such as Kroger 64.18 yesterday.",
    });
  }

  const categoryRows = Array.isArray(body?.categories) ? body.categories : [];
  const categories = categoryRows
    .map((entry) => {
      const row = asRecord(entry);
      if (!row) return null;
      const key = String(row.key || "").trim();
      const label = String(row.label || "").trim().slice(0, 120);
      if (!key || key.length > 400 || !label) return null;
      return { key, label };
    })
    .filter((row): row is { key: string; label: string } => Boolean(row))
    .slice(0, 120);

  let key: string | null = null;
  let skip = false;
  if (categories.length) {
    try {
      const allowed = new Set(categories.map((category) => category.key));
      const raw = asRecord(
        await generateJson(
          [
            "Assign this one transaction to one category key.",
            'Return {"key":"e:1","skip":false}.',
            "key must be copied from categories, or null.",
            "Set skip true and key null for transfers, credit-card payments, paychecks, and other rows that are not spending.",
            "If it might be spending but no category fits, set key null and skip false.",
            "Do not invent keys. Do not change the amount.",
          ].join(" "),
          { categories, description: parsed.description, amount: parsed.amount },
        ),
      );
      const keyRaw = raw?.key == null || raw.key === "" ? null : String(raw.key).trim();
      key = keyRaw && allowed.has(keyRaw) ? keyRaw : null;
      skip = key ? false : Boolean(raw?.skip);
    } catch (error) {
      console.error("transaction draft category failed", error);
    }
  }

  return {
    draft: {
      description: parsed.description,
      amount: parsed.amount,
      date: parsed.date,
      key,
      skip,
    },
  };
});
