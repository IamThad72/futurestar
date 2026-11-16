import { createError, readBody } from "h3";
import { getSessionUserId } from "../../utils/auth";
import { generateNote } from "../../utils/aiNote";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export default defineEventHandler(async (event) => {
  await getSessionUserId(event);
  const body = asRecord(await readBody(event));
  const year = Number(body?.year);
  const rows = (Array.isArray(body?.rows) ? body.rows : [])
    .map((entry) => {
      const row = asRecord(entry);
      if (!row) return null;
      const label = String(row.label || "").trim().slice(0, 80);
      const amount = Number(row.amount);
      if (!label || !Number.isFinite(amount)) return null;
      return { label, amount: Math.round(amount * 100) / 100 };
    })
    .filter((row): row is { label: string; amount: number } => Boolean(row))
    .slice(0, 24);

  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !rows.length) {
    throw createError({ statusCode: 400, statusMessage: "Send the year and the figures already on the page." });
  }

  const owed = rows.filter((row) => /owed|refund/i.test(row.label));
  const fallback = owed.length
    ? `${year}: ${owed.map((row) => `${row.label} is $${Math.abs(row.amount).toFixed(2)}`).join("; ")}.`
    : `${year} uses the totals already shown on this page.`;
  const text =
    (await generateNote(
      "Explain these tax figures in one or two sentences. They are already calculated. Do not give filing strategy or a new amount.",
      { year, rows },
    )) || fallback;
  return { text };
});
