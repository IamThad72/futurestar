/** Browser tab title. The brand alone is not repeated. */
export function documentTitle(title) {
  const chunk = typeof title === "string" ? title.trim() : "";
  if (!chunk || chunk === "Future Star") return "Future Star";
  return `${chunk} · Future Star`;
}
