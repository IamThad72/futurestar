/** Today strip for Physical Home. Counts come from the journals. */

export function summarizeTraining(rows, today) {
  const sessions = new Set();
  const mobility = new Set();
  let loggedToday = false;
  for (const row of rows || []) {
    const id = row.sessionId;
    if (id == null) continue;
    sessions.add(id);
    if (String(row.day || "") === today) loggedToday = true;
    const name = `${row.name || ""} ${row.exerciseName || ""}`.toLowerCase();
    if (/stretch|yoga|mobil|flexib/.test(name)) mobility.add(id);
  }
  return {
    loggedToday,
    sessions: sessions.size,
    mobilitySessions: mobility.size,
  };
}

export function todaySentence(facts) {
  const parts = [];
  parts.push(facts?.loggedToday ? "A session is logged today." : "No session is logged today.");
  if (facts?.proteinRemaining != null && Number.isFinite(Number(facts.proteinRemaining))) {
    const protein = Math.round(Number(facts.proteinRemaining));
    parts.push(protein > 0 ? `Protein is ${protein} g short of the plan.` : "Protein has reached the plan.");
  }
  const sessions = Number(facts?.sessions) || 0;
  if (sessions > 0 && !facts?.mobilitySessions) {
    parts.push(
      `You logged ${sessions} session${sessions === 1 ? "" : "s"} in the last 7 days, and no mobility.`,
    );
  } else if (sessions > 0) {
    parts.push(`You logged ${sessions} session${sessions === 1 ? "" : "s"} in the last 7 days.`);
  }
  return parts.join(" ");
}
