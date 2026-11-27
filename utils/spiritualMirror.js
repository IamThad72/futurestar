/**
 * Counts for a week of spiritual reviews, and the note written from those counts.
 * That note is the whole weekly mirror. It never calls a model or sends the week's words out.
 */

function countValues(reviews, key) {
  const counts = new Map();
  for (const review of reviews || []) {
    const value = String(review?.[key] || "").trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function repeatedWords(reviews, keys) {
  const stop = new Set(["this", "that", "with", "from", "have", "been", "were", "they", "them", "about", "after", "before", "today", "tomorrow"]);
  const counts = new Map();
  for (const review of reviews || []) {
    const text = keys.map((key) => review?.[key] || "").join(" ").toLowerCase();
    const words = text.match(/[a-z][a-z']{3,}/g) || [];
    const seen = new Set();
    for (const word of words) {
      if (stop.has(word) || seen.has(word)) continue;
      seen.add(word);
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([word, count]) => ({ word, count }));
}

export function mirrorFacts(reviews) {
  const rows = reviews || [];
  const virtues = countValues(rows, "virtue");
  const tomorrowFilled = rows.filter((row) => String(row.tomorrow || "").trim()).length;
  const words = repeatedWords(rows, ["troubled", "shortfall"]);
  return {
    days: rows.length,
    virtues: virtues.slice(0, 3).map(([name, count]) => ({ name, count })),
    tomorrowFilled,
    words,
  };
}

export function mirrorSentence(facts) {
  if (!facts?.days) return "No reviews are saved for this week yet.";
  const parts = [`${facts.days} day${facts.days === 1 ? "" : "s"} have a review`];
  if (facts.virtues?.length) {
    const named = facts.virtues.map((row) => `${row.name} ${row.count} time${row.count === 1 ? "" : "s"}`).join(", ");
    parts.push(`virtues named: ${named}`);
  }
  parts.push(`tomorrow was filled ${facts.tomorrowFilled} time${facts.tomorrowFilled === 1 ? "" : "s"}`);
  if (facts.words?.length) {
    parts.push(`repeated words include ${facts.words.map((row) => row.word).join(", ")}`);
  }
  return `${parts.join(". ")}.`;
}

/** Facts and the app-written note for one week. This is the only mirror text. */
export function weeklyMirror(reviews) {
  const facts = mirrorFacts(reviews);
  return { facts, text: mirrorSentence(facts) };
}
