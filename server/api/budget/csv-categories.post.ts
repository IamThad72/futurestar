import { createError, readBody } from "h3";
import { getSessionUserId } from "../../utils/auth";
import { generateJson } from "../../utils/groq";

type Assignment = { index: number; key: string | null; skip: boolean };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export default defineEventHandler(async (event) => {
  await getSessionUserId(event);
  const body = asRecord(await readBody(event));
  const categoryRows = Array.isArray(body?.categories) ? body.categories : [];
  const transactionRows = Array.isArray(body?.rows) ? body.rows : [];

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

  const rows = transactionRows
    .map((entry) => {
      const row = asRecord(entry);
      if (!row) return null;
      const index = Number(row.index);
      const description = String(row.description || "").trim().slice(0, 160);
      const amount = Number(row.amount);
      if (!Number.isInteger(index) || index < 0 || index > 500 || !description || !Number.isFinite(amount)) return null;
      return { index, description, amount: Math.round(Math.abs(amount) * 100) / 100 };
    })
    .filter((row): row is { index: number; description: string; amount: number } => Boolean(row))
    .slice(0, 40);

  if (!categories.length) {
    throw createError({ statusCode: 400, statusMessage: "Add expense categories before importing a file." });
  }
  if (!rows.length) return { assignments: [] as Assignment[] };

  const allowed = new Set(categories.map((category) => category.key));
  const raw = asRecord(
    await generateJson(
      [
        "Assign each bank transaction to one category key.",
        'Return {"assignments":[{"index":0,"key":"e:1","skip":false}]}.',
        "key must be copied from categories, or null.",
        "Set skip true and key null for transfers, credit-card payments, paychecks, and other rows that are not spending.",
        "If a row might be spending but no category fits, set key null and skip false.",
        "Do not invent keys.",
      ].join(" "),
      { categories, rows },
    ),
  );

  const list = Array.isArray(raw?.assignments) ? raw.assignments : [];
  const assignments: Assignment[] = [];
  for (const entry of list) {
    const row = asRecord(entry);
    if (!row) continue;
    const index = Number(row.index);
    if (!Number.isInteger(index) || !rows.some((item) => item.index === index)) continue;
    const keyRaw = row.key == null || row.key === "" ? null : String(row.key).trim();
    const key = keyRaw && allowed.has(keyRaw) ? keyRaw : null;
    assignments.push({ index, key, skip: key ? false : Boolean(row.skip) });
  }
  return { assignments };
});
