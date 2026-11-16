/** Two sentences from saved holdings. Amounts are calculated here. */

function money(amount) {
  const n = Math.round(Number(amount) * 100) / 100;
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function describeHoldings(rows) {
  const valued = (rows || []).filter((row) => Number.isFinite(row.currentValue) && row.currentValue > 0);
  const total = valued.reduce((sum, row) => sum + row.currentValue, 0);
  if (!valued.length || !(total > 0)) return [];
  const ranked = [...valued].sort((a, b) => b.currentValue - a.currentValue);
  const top = ranked[0];
  const share = Math.round((top.currentValue / total) * 1000) / 10;
  const sentences = [
    `${top.name} is ${share}% of current value, calculated from saved positions.`,
  ];
  const withGain = (rows || []).filter((row) => Number.isFinite(row.gainDollars) && row.gainDollars !== 0);
  if (withGain.length) {
    const gain = [...withGain].sort((a, b) => b.gainDollars - a.gainDollars)[0];
    const loss = [...withGain].sort((a, b) => a.gainDollars - b.gainDollars)[0];
    const parts = [];
    if (gain.gainDollars > 0) parts.push(`the largest unrealized gain is ${gain.name} at ${money(gain.gainDollars)}`);
    if (loss.gainDollars < 0 && loss.name !== gain.name) {
      parts.push(`the largest unrealized loss is ${loss.name} at ${money(loss.gainDollars)}`);
    } else if (loss.gainDollars < 0 && gain.gainDollars <= 0) {
      parts.push(`the largest unrealized loss is ${loss.name} at ${money(loss.gainDollars)}`);
    }
    if (parts.length) {
      const line = `${parts.join(", and ")}.`;
      sentences.push(line.charAt(0).toUpperCase() + line.slice(1));
    }
  }
  return sentences;
}
