/** Display formatting for investment amounts. Rounding happens only here. */

export function formatInvestmentCurrency(amount, currency = "USD", { signed = false } = {}) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(amount);
}

export function truncateDescription(description, length = 8) {
  const text = String(description || "").trim();
  if (text.length <= length) return text;
  return `${text.slice(0, length).trimEnd()}…`;
}

export function formatInvestmentShares(shares) {
  if (typeof shares !== "number" || !Number.isFinite(shares)) return "N/A";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(shares);
}

export function formatInvestmentPercent(percent) {
  if (typeof percent !== "number" || !Number.isFinite(percent)) return "N/A";
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(percent);
  return `${formatted}%`;
}
