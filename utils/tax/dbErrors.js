/** Postgres undefined_table, or a message that names a missing relation. */
export function isMissingRelationError(error, relation = "") {
  if (error?.code === "42P01") return true;
  const message = String(error?.message || "");
  if (!/does not exist/i.test(message)) return false;
  if (!relation) return true;
  return message.includes(relation);
}
