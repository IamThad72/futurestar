/** Flag a recommended service when the last matching record is past its interval. */

function parseIso(value) {
  const match = String(value || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function monthsBetween(from, to) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

function words(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3);
}

function sharesWord(left, right) {
  const wanted = new Set(words(left));
  return words(right).some((word) => wanted.has(word));
}

export function dueServices({ today, currentMileage, recommended, known }) {
  const todayDate = parseIso(today);
  if (!todayDate) return [];
  const mileage = Number(currentMileage);
  const hasMileage = Number.isFinite(mileage) && mileage >= 0;
  const records = known || [];
  const due = [];
  for (const item of recommended || []) {
    const last = records.find((row) => sharesWord(item.service_name, row.service_name));
    if (!last) continue;
    const reasons = [];
    const lastDate = parseIso(last.service_date);
    const intervalMonths = Number(item.interval_months);
    if (lastDate && intervalMonths > 0 && monthsBetween(lastDate, todayDate) >= intervalMonths) {
      reasons.push(`${intervalMonths} months since the last record`);
    }
    const intervalMiles = Number(item.interval_miles);
    const lastMiles = Number(last.mileage);
    if (hasMileage && intervalMiles > 0 && Number.isFinite(lastMiles) && mileage - lastMiles >= intervalMiles) {
      reasons.push(`${intervalMiles.toLocaleString("en-US")} miles since the last record`);
    }
    if (!reasons.length) continue;
    due.push({
      service_name: item.service_name,
      reason: reasons.join("; "),
      mileage: hasMileage ? mileage : null,
    });
  }
  return due.slice(0, 5);
}
