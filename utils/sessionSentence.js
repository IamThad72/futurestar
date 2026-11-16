/** Split one spoken workout into sets, reps, weight, or minutes. */

function cleanName(chunk) {
  return String(chunk || "")
    .replace(/\d+\s*[x×]\s*\d+/gi, " ")
    .replace(/\d+(?:\.\d+)?\s*(?:min|mins|minutes|sec|secs|seconds)\b/gi, " ")
    .replace(/(?:\bat\b|@)\s*\d+(?:\.\d+)?\s*(?:lb|lbs|kg)?/gi, " ")
    .replace(/\b(on|the|a|an|for|then|and)\b/gi, " ")
    .replace(/[^a-z0-9\s'-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function parseMove(chunk) {
  const text = String(chunk || "").trim();
  if (!text) return null;
  const setsReps = text.match(/(\d+)\s*[x×]\s*(\d+)/i);
  const minutes = text.match(/(\d+(?:\.\d+)?)\s*(?:min|mins|minutes)\b/i);
  const seconds = text.match(/(\d+)\s*(?:sec|secs|seconds)\b/i);
  const weight = text.match(/(?:\bat\b|@)\s*(\d+(?:\.\d+)?)\s*(lb|lbs|kg)?/i);
  const name = cleanName(text);
  if (name.length < 2) return null;
  const durationSeconds = minutes
    ? Math.round(Number(minutes[1]) * 60)
    : seconds
      ? Number(seconds[1])
      : null;
  return {
    name,
    sets: setsReps ? Math.min(12, Math.max(1, Number(setsReps[1]))) : 1,
    reps: setsReps ? Math.min(999, Number(setsReps[2])) : null,
    weight: weight ? Math.round(Number(weight[1]) * 100) / 100 : null,
    weightUnit: weight && /kg/i.test(weight[2] || "") ? "kg" : "lb",
    durationSeconds: durationSeconds && durationSeconds > 0 ? Math.min(86400, durationSeconds) : null,
  };
}

export function parseSessionSentence(text) {
  const raw = String(text || "").trim();
  if (raw.length < 2 || raw.length > 400) return [];
  return raw
    .split(/\bthen\b|,|;/i)
    .map(parseMove)
    .filter(Boolean)
    .slice(0, 12);
}
